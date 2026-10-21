"""Compare restored COPY text with live rows without disclosing their contents."""
from pathlib import Path
from collections import Counter
import json
import os
import re
import subprocess
from urllib.parse import urlparse

REPO = Path(__file__).resolve().parent.parent
PG = Path('C:/Program Files/PostgreSQL/17/bin')


def compare_table(table, activation, target, environment):
    result = subprocess.run([str(PG / 'pg_restore.exe'), '--data-only', '--table=' + table, '--file=-', activation['backupPath']], capture_output=True, check=True)
    text = result.stdout.decode('utf-8')
    header = re.search(r'^COPY public\.' + table + r' \(([^\n]+)\) FROM stdin;\r?$', text, re.MULTILINE)
    assert header, 'COPY header missing'
    columns = [part.strip().strip('"') for part in header.group(1).split(',')]
    assert all(re.fullmatch('[a-z_][a-z_0-9]*', part) for part in columns)
    original = text[header.end():].lstrip('\r\n').split('\n\\.')[0].splitlines()
    query = 'COPY (SELECT ' + ','.join('"' + c + '"' for c in columns) + ' FROM public.' + table + ') TO STDOUT;'
    live = subprocess.run([str(PG / 'psql.exe'), '-h', target.hostname, '-p', str(target.port or 5432), '-U', os.environ['APP_DB_USERNAME'], '-d', 'hermes', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-c', query], env=environment, capture_output=True, check=True).stdout.decode('utf-8').splitlines()
    id_index = columns.index('id')
    before = {parts[id_index]: parts for row in original if row and (parts := row.split('\t'))}
    after = {parts[id_index]: parts for row in live if row and (parts := row.split('\t'))}
    differences = Counter()
    for key in before.keys() & after.keys():
        assert len(before[key]) == len(after[key]) == len(columns)
        for column, old, new in zip(columns, before[key], after[key]):
            if old != new:
                differences[column] += 1
    report = {'table': 'public.' + table, 'rows_before': len(before), 'rows_after': len(after),
              'added_rows': len(after.keys() - before.keys()), 'removed_rows': len(before.keys() - after.keys()),
              'changed_fields_counts': dict(differences)}
    if table == 'admin_background_job':
        report['new_jobs'] = [{field: after[key][columns.index(field)] for field in ['job_type', 'trigger_source', 'status']}
                              for key in after.keys() - before.keys()]
    return report


def main():
    activation = json.loads((REPO / 'replica/statshunters/validation/heatmap-activation.json').read_text(encoding='utf-8-sig'))
    target = urlparse(os.environ['APP_DB_URL'].removeprefix('jdbc:'))
    assert target.hostname in ['localhost', '127.0.0.1'] and target.path == '/hermes'
    environment = dict(os.environ, PGPASSWORD=os.environ['APP_DB_PASSWORD'])
    reports = [compare_table(table, activation, target, environment) for table in ['runner', 'admin_background_job']]
    root = Path(activation['backupPath']).parent
    (root / 'post-restart-row-audit.json').write_text(json.dumps(reports, indent=2), encoding='utf-8')
    print(json.dumps(reports))


if __name__ == '__main__':
    main()
