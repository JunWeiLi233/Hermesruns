import { useCallback, useEffect, useRef, useState } from 'react';
import { apiJson } from '../../api';
import { checkedExpansion, commandOperation } from './entertainmentExpansionModel';

const ROOT = '/api/entertainment';

function removedResource(command, result) {
  if (!result || result.deleted !== true || typeof result.id !== 'string' || !result.id
    || Object.keys(result).some(key => !['id', 'deleted'].includes(key))) return null;
  if (command.operation === 'memory.create' || command.operation === `memory.update/${result.id}`) return 'memory';
  if (['group.create', 'invite.accept'].includes(command.operation)) return 'group';
  // Existing-resource operations must name the same group as the tombstone.
  const [operation, groupId] = command.operation.split('/');
  return ['group.slot', 'group.invite', 'group.revoke', 'group.leave', 'group.delete'].includes(operation)
    && groupId === result.id ? 'group' : null;
}

function confirmRemoved(kind, result, current) {
  if (current[kind === 'memory' ? 'memories' : 'groups'].some(row => row.id === result.id)) {
    throw new Error('Resource removal not confirmed');
  }
}

function unavailableGroup(command, result, accountId) {
  const [operation, groupId] = command.operation.split('/');
  if (operation !== 'invite.accept' && operation !== 'group.slot') return false;
  if (operation === 'group.slot' && groupId !== result?.id) return false;
  if (Array.isArray(result?.members) && result.members.some(member => member?.accountId === accountId)) return false;
  // Leave scrubs membership/contributions in an ordinary snapshot, not a
  // deletion tombstone. Validate that shape without rendering/retaining it.
  const stringId = value => typeof value === 'string' && Boolean(value);
  if (!result || !stringId(result.id) || !stringId(result.ownerAccountId) || result.ownerAccountId === accountId
    || !Number.isInteger(result.version) || result.version < 0
    || !(result.lastRequestId === null || stringId(result.lastRequestId))
    || Object.keys(result).some(key => !['id', 'ownerAccountId', 'version', 'lastRequestId', 'members', 'slots', 'complete', 'invites'].includes(key))
    || !Array.isArray(result.members) || !result.members.length || result.members.length > 4
    || !result.members.every(member => member && stringId(member.accountId) && Object.keys(member).length === 1)
    || new Set(result.members.map(member => member.accountId)).size !== result.members.length
    || !result.members.some(member => member.accountId === result.ownerAccountId)
    || !Array.isArray(result.invites) || result.invites.length !== 0
    || !Array.isArray(result.slots) || result.slots.length !== 4
    || !result.slots.every((slot, index) => slot && slot.index === index && Object.keys(slot).length === 3
      && (slot.symbol === null || ['sun', 'leaf', 'star', 'wave'].includes(slot.symbol))
      && (slot.symbol === null ? slot.contributorAccountId === null : result.members.some(member => member.accountId === slot.contributorAccountId)))
    || typeof result.complete !== 'boolean' || result.complete !== result.slots.every(slot => slot.symbol !== null)) {
    throw new Error('Invalid scrubbed group receipt');
  }
  return true;
}

function exactReceipt(command, receipt) {
  return receipt?.requestId === command.body.requestId && receipt.operation === command.operation;
}

async function read(signal) {
  const [state, metadata] = await Promise.all([
    apiJson(`${ROOT}/me`, { signal }), apiJson(`${ROOT}/metadata`, { signal }),
  ]);
  return checkedExpansion(state, metadata);
}

export default function useEntertainmentExpansion() {
  const [data, setData] = useState(null);
  const [phase, setPhase] = useState('loading');
  const [pending, setPending] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [commit, setCommit] = useState(null);
  const active = useRef(true);
  const busy = useRef(false);
  const pendingRef = useRef(null);
  const controller = useRef(null);

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true; setPhase('loading');
    const request = new AbortController();
    controller.current = request;
    try {
      const result = await read(request.signal);
      if (active.current && !request.signal.aborted) { setData(result); setPhase('ready'); }
    } catch { if (active.current && !request.signal.aborted) setPhase('load-error'); }
    finally { if (controller.current === request) busy.current = false; }
  }, []);

  useEffect(() => {
    active.current = true;
    load();
    return () => { active.current = false; controller.current?.abort(); busy.current = false; };
  }, [load]); // This hook lives only inside the account-keyed session.

  function settle(command, result, current, recovered, outcome = 'saved', removedKind = null) {
    setData(current); pendingRef.current = null; setPending(null); setErrorStatus(null);
    // Bearer secrets are never retained in receipt/commit state.
    const safeResult = outcome === 'unavailable' ? { id: result.id }
      : command.scope === 'invite' && !removedKind ? { ...result, token: null } : result;
    setCommit({ scope: command.scope, requestId: command.body.requestId, result: safeResult, recovered, outcome, removedKind });
    setPhase(outcome);
  }

  async function run(command, recovered = false) {
    if (busy.current) return false;
    busy.current = true; pendingRef.current = command; setPending(command); setPhase('saving'); setErrorStatus(null);
    controller.current = new AbortController();
    try {
      const result = await apiJson(`${ROOT}${command.path}`, {
        method: command.method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(command.body), signal: controller.current.signal,
      });
      if (!active.current) return false;
      let outcome = 'saved';
      const removedKind = recovered ? removedResource(command, result) : null;
      const unavailable = recovered && !removedKind && unavailableGroup(command, result, data.accountId);
      if (removedKind || unavailable || !command.matches(result)) {
        // Redacted retries prove no original values. Authenticate the exact
        // request and operation receipt, then read current state before release.
        if (!removedKind && !unavailable) throw new Error('Invalid entertainment response');
        const receipt = await apiJson(`${ROOT}/requests/${command.body.requestId}`, { signal: controller.current.signal });
        if (!exactReceipt(command, receipt)
          || (unavailable ? !unavailableGroup(command, receipt.result, data.accountId) : removedResource(command, receipt.result) !== removedKind)
          || receipt.result.id !== result.id) throw new Error('No matching removed resource command');
        outcome = unavailable ? 'unavailable' : 'removed';
      }
      const current = await read(controller.current.signal);
      if (!active.current) return false;
      if (removedKind || unavailable) confirmRemoved(removedKind || 'group', result, current);
      settle(command, result, current, recovered, outcome, removedKind || (unavailable ? 'group' : null));
      return unavailable ? { id: result.id } : result;
    } catch (error) {
      if (active.current) { setErrorStatus(error.status || null); setPhase('save-error'); }
      return false;
    } finally { busy.current = false; }
  }

  function save({ path, method = 'POST', body = {}, scope, matches }) {
    if (busy.current || pendingRef.current) return Promise.resolve(false);
    return run({ path, method, scope, matches, operation: commandOperation(method, path), body: { ...body, requestId: crypto.randomUUID() } });
  }

  async function reconcile() {
    const command = pendingRef.current;
    if (busy.current || !command) return;
    busy.current = true; setPhase('loading'); controller.current = new AbortController();
    try {
      const receipt = await apiJson(`${ROOT}/requests/${command.body.requestId}`, { signal: controller.current.signal });
      if (!exactReceipt(command, receipt)) throw new Error('No matching committed command');
      const removed = removedResource(command, receipt.result);
      const unavailable = !removed && unavailableGroup(command, receipt.result, data.accountId);
      if (!removed && !unavailable && !command.matches(receipt.result)) throw new Error('No matching committed result');
      const current = await read(controller.current.signal);
      if (removed || unavailable) confirmRemoved(removed || 'group', receipt.result, current);
      if (active.current) settle(command, receipt.result, current, true, unavailable ? 'unavailable' : removed ? 'removed' : 'saved', removed || (unavailable ? 'group' : null));
    } catch { if (active.current) setPhase('save-error'); }
    finally { busy.current = false; }
  }

  async function review() {
    // Only a definitive server rejection can release a command for editing.
    if (busy.current || ![400, 404, 409, 410].includes(errorStatus)) return;
    busy.current = true; setPhase('loading'); controller.current = new AbortController();
    try {
      const current = await read(controller.current.signal);
      if (active.current) {
        setData(current); pendingRef.current = null; setPending(null); setErrorStatus(null); setPhase('ready');
      }
    } catch { if (active.current) setPhase('save-error'); }
    finally { busy.current = false; }
  }

  return { data, phase, commit, pending, errorStatus, save, load, reconcile, review,
    retry: () => pendingRef.current && run(pendingRef.current, true),
    disabled: phase === 'loading' || phase === 'saving' || Boolean(pending),
  };
}
