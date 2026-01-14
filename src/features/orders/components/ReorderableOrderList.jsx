import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import {
  attachClosestEdge,
  extractClosestEdge,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { DropIndicator } from '@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box';

function reorderWithEdge({ ids, sourceId, targetId, edge }) {
  if (!Array.isArray(ids)) return [];
  if (!sourceId || !targetId) return ids;
  if (sourceId === targetId) return ids;

  const from = ids.indexOf(sourceId);
  const to = ids.indexOf(targetId);

  if (from === -1 || to === -1) return ids;

  const next = ids.slice();
  next.splice(from, 1);

  const isMovingDown = from < to;
  let insertAt = to;

  if (edge === 'bottom') {
    insertAt = to + 1;
  }

  // Comme on a retiré l'élément, les index après `from` bougent.
  if (isMovingDown) {
    insertAt -= 1;
  }

  if (insertAt < 0) insertAt = 0;
  if (insertAt > next.length) insertAt = next.length;

  next.splice(insertAt, 0, sourceId);
  return next;
}

function ReorderableItem({
  id,
  groupKey,
  render,
  onReorder,
  indicator,
  setIndicator,
  dragHandleSelector = '[data-dnd-handle]'
}) {
  const itemRef = useRef(null);

  const isActive = indicator?.id === id;
  const edge = isActive ? indicator.edge : null;

  useEffect(() => {
    const itemEl = itemRef.current;
    if (!itemEl) return;

    const handleEl = itemEl.querySelector(dragHandleSelector) || itemEl;

    return combine(
      draggable({
        element: handleEl,
        getInitialData: () => ({ type: 'pizzaiolo-order', id, groupKey }),
      }),
      dropTargetForElements({
        element: itemEl,
        getData: ({ input, element }) => {
          return attachClosestEdge(
            { type: 'pizzaiolo-order', id, groupKey },
            {
              input,
              element,
              allowedEdges: ['top', 'bottom'],
            }
          );
        },
        canDrop: ({ source }) => {
          return source?.data?.type === 'pizzaiolo-order' && source?.data?.groupKey === groupKey;
        },
        onDragEnter: ({ self }) => {
          const closest = extractClosestEdge(self.data);
          setIndicator({ id, edge: closest || 'bottom' });
        },
        onDrag: ({ self }) => {
          const closest = extractClosestEdge(self.data);
          setIndicator({ id, edge: closest || 'bottom' });
        },
        onDragLeave: () => {
          setIndicator((prev) => (prev?.id === id ? null : prev));
        },
        onDrop: ({ source, self }) => {
          setIndicator(null);
          const sourceId = source?.data?.id;
          const targetId = self?.data?.id;
          const closest = extractClosestEdge(self.data) || 'bottom';
          if (!sourceId || !targetId) return;
          onReorder?.({ sourceId, targetId, edge: closest });
        },
      })
    );
  }, [id, groupKey, onReorder, setIndicator, dragHandleSelector]);

  return (
    <div ref={itemRef} className="relative">
      {render()}
      {isActive && edge ? (
        <DropIndicator edge={edge} gap="8px" />
      ) : null}
    </div>
  );
}

/**
 * Rend une liste réordonnable (drag & drop vertical) sans wrapper de layout.
 * Les items rendus doivent contenir un élément avec `data-dnd-handle` (sinon tout l'item sert de poignée).
 */
export function ReorderableOrderList({
  orderedIds,
  groupKey,
  renderItem,
  onOrderedIdsChange,
  dragHandleSelector,
}) {
  const [indicator, setIndicator] = useState(null);

  const onReorder = useCallback(
    ({ sourceId, targetId, edge }) => {
      const next = reorderWithEdge({ ids: orderedIds, sourceId, targetId, edge });
      onOrderedIdsChange?.(next);
    },
    [orderedIds, onOrderedIdsChange]
  );

  const stableIds = useMemo(() => (Array.isArray(orderedIds) ? orderedIds : []), [orderedIds]);

  return (
    <>
      {stableIds.map((id) => (
        <ReorderableItem
          key={id}
          id={id}
          groupKey={groupKey}
          render={() => renderItem(id)}
          onReorder={onReorder}
          indicator={indicator}
          setIndicator={setIndicator}
          dragHandleSelector={dragHandleSelector}
        />
      ))}
    </>
  );
}
