import { getBezierPath, BaseEdge } from '@xyflow/react';

function SmartEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        stroke: 'var(--neon-cyan, #06b6d4)',
        strokeWidth: 2,
        ...style,
      }}
    />
  );
}

export default SmartEdge;
