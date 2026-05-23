// =====================================================
// Odinote — Connector v3
// • Endpoints always anchor to the CENTER of a node.
// • The arrow keeps a small GAP from the node (never touches it).
// • The section that runs inside the node (center → edge) is drawn dotted
//   (rendered on top of nodes) and the center anchor shows clearly when selected.
// • Supports bidirectional arrows and a text label.
// =====================================================

function getCenter(item) { return { x: item.x + item.w / 2, y: item.y + item.h / 2 }; }

// Where the ray from the item's center toward (tx,ty) exits the item's rectangle
function edgeIntersect(item, tx, ty) {
  const cx = item.x + item.w / 2, cy = item.y + item.h / 2;
  const dx = tx - cx, dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const hw = item.w / 2, hh = item.h / 2;
  const sx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
}

// Legacy helpers kept for backward compatibility (Canvas still calls these for creation)
function getAnchorPoint(item, anchor) {
  if (!item) return null;
  return getCenter(item); // always the center now
}
function closestAnchorTo() { return 'center'; }
function getNodeRect(itemId, items) {
  if (!items) return null;
  const topItem = items.find(i => i.id === itemId);
  if (topItem) {
    return { id: topItem.id, x: topItem.x, y: topItem.y, w: topItem.w, h: topItem.h };
  }
  for (const it of items) {
    if (it.type === 'column' && it.children) {
      const idx = it.children.findIndex(c => c.id === itemId);
      if (idx !== -1) {
        const child = it.children[idx];
        let relY = 52;
        for (let i = 0; i < idx; i++) {
          const prev = it.children[i];
          const prevH = prev.h || (prev.type === 'note' ? 90 :
                                  prev.type === 'todo' ? 140 :
                                  prev.type === 'link' ? 180 :
                                  prev.type === 'image' ? 140 :
                                  prev.type === 'doc' ? 90 :
                                  prev.type === 'board' ? 130 :
                                  prev.type === 'comment' ? 80 :
                                  prev.type === 'calendar' ? 220 : 90);
          relY += prevH + 7;
        }
        const w = (it.w || 320) - 24;
        const h = child.h || (child.type === 'note' ? 90 :
                              child.type === 'todo' ? 140 :
                              child.type === 'link' ? 180 :
                              child.type === 'image' ? 140 :
                              child.type === 'doc' ? 90 :
                              child.type === 'board' ? 130 :
                              child.type === 'comment' ? 80 :
                              child.type === 'calendar' ? 220 : 90);
        return {
          id: child.id,
          x: it.x + 12,
          y: it.y + relY,
          w: w,
          h: h
        };
      }
    }
  }
  return null;
}
window.getNodeRect = getNodeRect;

function resolveEndpoint(end, items) {
  if (end?.itemId) {
    const rect = getNodeRect(end.itemId, items);
    if (rect) return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
  }
  return { x: end?.x ?? 0, y: end?.y ?? 0 };
}

function endInfo(end, items) {
  if (end?.itemId) {
    const rect = getNodeRect(end.itemId, items);
    if (rect) return { item: rect, center: { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 } };
  }
  return { item: null, center: { x: end?.x ?? 0, y: end?.y ?? 0 } };
}

function Connector({ conn, items, selected, selectedIds, onSelect, onUpdate, onDragNodes, onDragNodesEnd, panZoom, screenToCanvas, layer }) {
  const from = conn.fromEnd || (conn.from ? { itemId: conn.from } : null);
  const to = conn.toEnd || (conn.to ? { itemId: conn.to } : null);
  if (!from || !to) return null;

  const A = endInfo(from, items);
  const B = endInfo(to, items);
  const cA = A.center, cB = B.center;
  const bend = conn.bend || { x: 0, y: 0 };
  const shape = conn.shape || 'curve';

  // Move a point toward a target by `g` pixels (clamped so it never overshoots)
  const moveToward = (from, to, g) => {
    const dx = to.x - from.x, dy = to.y - from.y;
    const l = Math.hypot(dx, dy) || 1;
    const gg = Math.min(g, l * 0.6);
    return { x: from.x + (dx / l) * gg, y: from.y + (dy / l) * gg };
  };
  const GAP = 12;

  let eA, eB, p1, p2, qx, qy, path, hx, hy, angleEnd, angleStart;

  if (shape === 'orthogonal') {
    // Flexible right-angle routing through a freely-draggable 2D waypoint (W). The line
    // passes THROUGH W, so dragging it deforms the route in any direction (incl. vertically).
    const hwA = A.item ? A.item.w / 2 : 0, hhA = A.item ? A.item.h / 2 : 0;
    const hwB = B.item ? B.item.w / 2 : 0, hhB = B.item ? B.item.h / 2 : 0;
    const W = { x: (cA.x + cB.x) / 2 + (bend.x || 0), y: (cA.y + cB.y) / 2 + (bend.y || 0) };

    const exitFor = (c, hw, hh, hasItem) => {
      const ddx = W.x - c.x, ddy = W.y - c.y;
      if (Math.abs(ddx) >= Math.abs(ddy)) {
        const sgn = ddx >= 0 ? 1 : -1;
        const e = { x: c.x + sgn * hw, y: c.y };
        return { e, dir: 'h', p: hasItem ? { x: e.x + sgn * GAP, y: e.y } : { x: e.x, y: e.y } };
      }
      const sgn = ddy >= 0 ? 1 : -1;
      const e = { x: c.x, y: c.y + sgn * hh };
      return { e, dir: 'v', p: hasItem ? { x: e.x, y: e.y + sgn * GAP } : { x: e.x, y: e.y } };
    };

    const exA = exitFor(cA, hwA, hhA, !!A.item);
    const exB = exitFor(cB, hwB, hhB, !!B.item);
    eA = exA.e; eB = exB.e;
    p1 = exA.p; p2 = exB.p;

    // Path: p1 → (L-corner) → W → (L-corner) → p2, each leg aligned to its exit axis.
    const pts = [p1];
    pts.push(exA.dir === 'h' ? { x: W.x, y: p1.y } : { x: p1.x, y: W.y });
    pts.push(W);
    pts.push(exB.dir === 'h' ? { x: W.x, y: p2.y } : { x: p2.x, y: W.y });
    pts.push(p2);
    // Collapse coincident points so we don't emit zero-length kinks
    const clean = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const prev = clean[clean.length - 1];
      if (Math.abs(prev.x - pts[i].x) < 0.5 && Math.abs(prev.y - pts[i].y) < 0.5) continue;
      clean.push(pts[i]);
    }
    path = 'M ' + clean.map(pt => `${pt.x} ${pt.y}`).join(' L ');
    hx = W.x; hy = W.y;
    const cn = clean.length;
    angleEnd = B.item
      ? Math.atan2(eB.y - p2.y, eB.x - p2.x)
      : (cn >= 2 ? Math.atan2(clean[cn-1].y - clean[cn-2].y, clean[cn-1].x - clean[cn-2].x) : 0);
    angleStart = A.item
      ? Math.atan2(eA.y - p1.y, eA.x - p1.x)
      : (cn >= 2 ? Math.atan2(clean[0].y - clean[1].y, clean[0].x - clean[1].x) : 0);
  } else {
    // Control point from the CENTERS (stable). Edges point TOWARD the control point so the
    // dotted "covered" segment and the curve line up at the node edge.
    qx = (cA.x + cB.x) / 2 + bend.x;
    qy = (cA.y + cB.y) / 2 + bend.y;
    eA = A.item ? edgeIntersect(A.item, qx, qy) : cA;
    eB = B.item ? edgeIntersect(B.item, qx, qy) : cB;
    p1 = moveToward(eA, { x: qx, y: qy }, GAP);
    p2 = moveToward(eB, { x: qx, y: qy }, GAP);
    path = `M ${p1.x} ${p1.y} Q ${qx} ${qy} ${p2.x} ${p2.y}`;
    hx = 0.25 * p1.x + 0.5 * qx + 0.25 * p2.x;
    hy = 0.25 * p1.y + 0.5 * qy + 0.25 * p2.y;
    angleEnd = Math.atan2(p2.y - qy, p2.x - qx);   // arrival direction at the head
    angleStart = Math.atan2(p1.y - qy, p1.x - qx); // arrival direction at the tail (bidir)
  }

  const strokeColor = conn.color || 'var(--ink)';
  const isMultiSelected = selectedIds && selectedIds.includes(conn.id);
  const sel = (selected || isMultiSelected) ? 'var(--wine)' : strokeColor;
  const bidir = !!conn.bidirectional;
  const label = conn.label || '';

  // Label pill follows the connector colour; pick readable text via luminance for hex colours
  let labelText = '#fff';
  if (!selected && /^#/.test(strokeColor)) {
    const c = strokeColor.replace('#', '');
    const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    if ((0.299 * r + 0.587 * g + 0.114 * b) > 150) labelText = '#1A1A1A';
  }

  const arrowPts = (px, py, ang) => {
    const ah = 11, aw = 7;
    const a1x = px - ah * Math.cos(ang) + aw * Math.cos(ang + Math.PI / 2);
    const a1y = py - ah * Math.sin(ang) + aw * Math.sin(ang + Math.PI / 2);
    const a2x = px - ah * Math.cos(ang) - aw * Math.cos(ang + Math.PI / 2);
    const a2y = py - ah * Math.sin(ang) - aw * Math.sin(ang + Math.PI / 2);
    return `${px},${py} ${a1x},${a1y} ${a2x},${a2y}`;
  };

  // Dotted "covered" segments (center → edge) — only for node-anchored ends
  const dottedA = A.item ? `M ${cA.x} ${cA.y} L ${eA.x} ${eA.y}` : null;
  const dottedB = B.item ? `M ${cB.x} ${cB.y} L ${eB.x} ${eB.y}` : null;

  const dashArray =
    conn.style === 'dashed' ? '10 7' :
    conn.style === 'dotted' ? '1 6' : null;

  const handleCurveDrag = (e) => {
    e.stopPropagation(); e.preventDefault();
    onSelect && onSelect(conn.id);
    const startX = e.clientX, startY = e.clientY;
    const startBendX = bend.x, startBendY = bend.y;
    const scale = panZoom?.scale || 1;
    // Curve uses a quadratic control point (curve midpoint moves at half rate → ×2);
    // orthogonal maps the bend 1:1 to the dragged segment.
    const mult = shape === 'orthogonal' ? 1 : 2;
    const onMove = (ev) => {
      const dxp = (ev.clientX - startX) / scale;
      const dyp = (ev.clientY - startY) / scale;
      onUpdate(conn.id, { bend: { x: startBendX + dxp * mult, y: startBendY + dyp * mult } });
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Drag the connector line itself: hold + move TRANSLATES the whole connector together
  // with its two attached nodes (the shape/curvature is preserved). A plain click
  // (no movement) selects it for editing.
  const handleLineDrag = (e) => {
    e.stopPropagation(); e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const scale = panZoom?.scale || 1;
    // Capture starting positions of attached nodes and free endpoints
    const nodeStarts = [];
    if (A.item) nodeStarts.push({ id: A.item.id, x: A.item.x, y: A.item.y });
    if (B.item) nodeStarts.push({ id: B.item.id, x: B.item.x, y: B.item.y });
    const fromFree = !A.item ? { x: from.x ?? cA.x, y: from.y ?? cA.y } : null;
    const toFree = !B.item ? { x: to.x ?? cB.x, y: to.y ?? cB.y } : null;
    let moved = false;
    const onMove = (ev) => {
      const dxp = (ev.clientX - startX) / scale;
      const dyp = (ev.clientY - startY) / scale;
      if (!moved && (Math.abs(dxp) > 2 || Math.abs(dyp) > 2)) moved = true;
      if (!moved) return;
      if (nodeStarts.length && onDragNodes) {
        onDragNodes(nodeStarts.map(n => ({ id: n.id, x: Math.round(n.x + dxp), y: Math.round(n.y + dyp) })));
      }
      if (fromFree) onUpdate(conn.id, { fromEnd: { x: fromFree.x + dxp, y: fromFree.y + dyp } });
      if (toFree)   onUpdate(conn.id, { toEnd:   { x: toFree.x + dxp,   y: toFree.y + dyp } });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (!moved) { onSelect && onSelect(conn.id); }            // plain click → edit mode
      else if (nodeStarts.length && onDragNodesEnd) onDragNodesEnd(nodeStarts.map(n => n.id)); // commit
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Drag the center anchor to re-attach to another node, or drop on empty canvas to free it
  const handleEndpointDrag = (which) => (e) => {
    e.stopPropagation(); e.preventDefault();
    onSelect && onSelect(conn.id);
    const onMove = (ev) => {
      const p = screenToCanvas(ev.clientX, ev.clientY);
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const itemEl = el?.closest('.item');
      const targetId = itemEl?.getAttribute('data-item-id');
      if (targetId) {
        const newEnd = { itemId: targetId };
        onUpdate(conn.id, which === 'from' ? { fromEnd: newEnd, from: undefined, fromAnchor: undefined } : { toEnd: newEnd, to: undefined, toAnchor: undefined });
      } else {
        const newEnd = { x: p.x, y: p.y };
        onUpdate(conn.id, which === 'from' ? { fromEnd: newEnd, from: undefined, fromAnchor: undefined } : { toEnd: newEnd, to: undefined, toAnchor: undefined });
      }
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // The handles layer (rendered ABOVE nodes) only carries the interactive
  // controls so the center anchors stay grabbable even when they sit inside a node.
  if (layer === 'handles') {
    if (!selected) return null;
    return (
      <g>
        {/* Dotted covered segments — center → node edge, drawn over the node */}
        {dottedA && <path className="connector-covered" d={dottedA} style={{ stroke: sel }}/>}
        {dottedB && <path className="connector-covered" d={dottedB} style={{ stroke: sel }}/>}
        {/* Center anchor handles */}
        <circle className="connector-handle endpoint" cx={cA.x} cy={cA.y} r={8} onMouseDown={handleEndpointDrag('from')}/>
        <circle className="connector-handle endpoint" cx={cB.x} cy={cB.y} r={8} onMouseDown={handleEndpointDrag('to')}/>
        {/* Curve bend handle */}
        <circle className="connector-handle curve" cx={hx} cy={hy} r={7} onMouseDown={handleCurveDrag}/>
      </g>
    );
  }

  // The lines layer (rendered BELOW nodes) carries the path, arrowheads and label.
  return (
    <g>
      {/* Invisible wide hit area — hold + drag moves the connector (no edit mode);
          a plain click selects it for editing. */}
      <path
        className="connector-hit"
        d={path}
        onMouseDown={handleLineDrag}
      />
      {/* Visible solid line */}
      <path
        className={`connector-path ${selected ? 'selected' : ''}`}
        d={path}
        style={{ stroke: sel }}
        strokeDasharray={dashArray}
        strokeWidth={selected ? 3 : 2}
      />
      {/* Arrowhead(s) */}
      <polygon className="arrowhead" points={arrowPts(p2.x, p2.y, angleEnd)} style={{ fill: sel }}/>
      {bidir && <polygon className="arrowhead" points={arrowPts(p1.x, p1.y, angleStart)} style={{ fill: sel }}/>}

      {/* Label */}
      {label && (
        <foreignObject x={hx - 75} y={hy - 13} width={150} height={26} style={{ overflow: 'visible', pointerEvents: 'none' }}>
          <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100%' }}>
            <span className="connector-label" style={{ background: sel, color: labelText, borderColor: sel }}>{label}</span>
          </div>
        </foreignObject>
      )}
    </g>
  );
}

window.Connector = Connector;
window.getAnchorPoint = getAnchorPoint;
window.closestAnchorTo = closestAnchorTo;
window.resolveEndpoint = resolveEndpoint;
