// =====================================================
// Odinote — Connector v3
// • Endpoints always anchor to the CENTER of a node.
// • The arrow keeps a small GAP from the node (never touches it).
// • The section that runs inside the node (center → edge) is drawn dotted
//   (rendered on top of nodes) and the center anchor shows clearly when selected.
// • Supports bidirectional arrows and a text label.
// =====================================================

function cleanupOrtho(ortho) {
  console.log('[DEBUG-ORTHO-CONNECTOR] Entrada cleanupOrtho:', JSON.stringify(ortho));
  if (!ortho || ortho.length <= 1) return ortho;

  let currentPts = ortho.map(p => ({ x: p.x, y: p.y }));
  let changed = true;
  let iterations = 0;
  const THRESHOLD = 10;

  while (changed && iterations < 5) {
    changed = false;
    iterations++;

    // 1. Alinear puntos que están casi alineados en el mismo eje (eliminar pequeñas desviaciones de arrastre)
    for (let i = 0; i < currentPts.length - 1; i++) {
      const p1 = currentPts[i];
      const p2 = currentPts[i + 1];
      if (Math.abs(p1.x - p2.x) > 0 && Math.abs(p1.x - p2.x) < THRESHOLD) {
        p2.x = p1.x;
        changed = true;
      }
      if (Math.abs(p1.y - p2.y) > 0 && Math.abs(p1.y - p2.y) < THRESHOLD) {
        p2.y = p1.y;
        changed = true;
      }
    }

    // 2. Fusionar puntos coincidentes o extremadamente cercanos (eliminar tramos vacíos/stubs)
    let merged = [currentPts[0]];
    for (let i = 1; i < currentPts.length; i++) {
      const prev = merged[merged.length - 1];
      const cur = currentPts[i];
      const dist = Math.hypot(cur.x - prev.x, cur.y - prev.y);
      if (dist < THRESHOLD) {
        changed = true;
      } else {
        merged.push(cur);
      }
    }
    currentPts = merged;

    if (currentPts.length <= 2) break;

    // 3. Eliminar puntos colineales
    let nonCollinear = [currentPts[0]];
    for (let i = 1; i < currentPts.length - 1; i++) {
      const prev = nonCollinear[nonCollinear.length - 1];
      const cur = currentPts[i];
      const next = currentPts[i + 1];

      const isCollinearX = Math.abs(prev.x - cur.x) < THRESHOLD && Math.abs(cur.x - next.x) < THRESHOLD;
      const isCollinearY = Math.abs(prev.y - cur.y) < THRESHOLD && Math.abs(cur.y - next.y) < THRESHOLD;

      if (isCollinearX) {
        cur.x = prev.x;
        next.x = prev.x;
        changed = true;
      } else if (isCollinearY) {
        cur.y = prev.y;
        next.y = prev.y;
        changed = true;
      } else {
        nonCollinear.push(cur);
      }
    }
    nonCollinear.push(currentPts[currentPts.length - 1]);
    currentPts = nonCollinear;

    if (currentPts.length <= 2) break;

    // 4. Eliminar zigzags/bucles en "U" redundantes (backtracking)
    let cleanLoops = [currentPts[0]];
    for (let i = 1; i < currentPts.length; i++) {
      const last = cleanLoops[cleanLoops.length - 1];
      const cur = currentPts[i];
      if (i < currentPts.length - 1) {
        const next = currentPts[i + 1];
        if (Math.abs(last.x - next.x) < THRESHOLD && Math.abs(last.y - cur.y) < THRESHOLD) {
          cleanLoops.pop();
          cleanLoops.push({ x: last.x, y: next.y });
          i++;
          changed = true;
          continue;
        }
      }
      cleanLoops.push(cur);
    }
    currentPts = cleanLoops;

    if (currentPts.length <= 2) break;

    // 5. Eliminar picos estrechos (zigzags de ida y vuelta muy pegados)
    let cleanPikes = [currentPts[0]];
    const PIKE_THRESHOLD = 15;
    for (let i = 1; i < currentPts.length - 1; i++) {
      const prev = cleanPikes[cleanPikes.length - 1];
      const cur = currentPts[i];
      const next = currentPts[i + 1];

      const isVerticalPike = Math.abs(prev.x - next.x) < PIKE_THRESHOLD;
      const isHorizontalPike = Math.abs(prev.y - next.y) < PIKE_THRESHOLD;

      if (isVerticalPike) {
        next.x = prev.x;
        changed = true;
      } else if (isHorizontalPike) {
        next.y = prev.y;
        changed = true;
      } else {
        cleanPikes.push(cur);
      }
    }
    cleanPikes.push(currentPts[currentPts.length - 1]);
    currentPts = cleanPikes;
  }

  console.log('[DEBUG-ORTHO-CONNECTOR] Salida cleanupOrtho:', JSON.stringify(currentPts));
  if (currentPts.length === 0) return ortho;
  return currentPts;
}

function cleanOrthoWithEndpoints(ortho, p1, p2, exA_dir, exB_dir) {
  if (!ortho || ortho.length === 0) return ortho;
  if (!p1 || !p2) return cleanupOrtho(ortho);

  const dA = exA_dir || 'h';
  const dB = exB_dir || 'h';

  // 1. Build full list of vertices
  const verts = [{ x: p1.x, y: p1.y }];
  let prev = p1, dir = dA;
  for (let k = 0; k < ortho.length; k++) {
    const wp = ortho[k];
    if (dir === 'h') {
      verts.push({ x: wp.x, y: prev.y });
      verts.push({ x: wp.x, y: wp.y });
      prev = { x: wp.x, y: wp.y };
    } else {
      verts.push({ x: prev.x, y: wp.y });
      verts.push({ x: wp.x, y: wp.y });
      prev = { x: wp.x, y: wp.y };
    }
    dir = (dir === 'h' ? 'v' : 'h');
  }
  if (dB === 'h') {
    verts.push({ x: prev.x, y: p2.y });
    verts.push({ x: p2.x, y: p2.y });
  } else {
    verts.push({ x: p2.x, y: prev.y });
    verts.push({ x: p2.x, y: p2.y });
  }

  // 2. Run cleanup on the full vertices list
  const cleanV = cleanupOrtho(verts);

  // 3. Extract the intermediate vertices as new waypoints
  let nextOrtho = cleanV.slice(1, cleanV.length - 1);
  if (nextOrtho.length === 0) {
    nextOrtho = [{ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }];
  }
  return nextOrtho;
}

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
    let w = topItem.w;
    let h = topItem.h;
    if (w === undefined || h === undefined) {
      const def = (window.defaultDims && window.defaultDims(topItem.type)) || { w: 200, h: 200 };
      if (w === undefined) w = def.w;
      if (h === undefined) h = def.h;
    }
    return { id: topItem.id, x: topItem.x, y: topItem.y, w, h };
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

function Connector({ conn, items, selected, selectedIds, onSelect, onUpdate, onDragNodes, onDragNodesEnd, panZoom, screenToCanvas, layer, theme }) {
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

  let eA, eB, p1, p2, qx, qy, path, hx, hy, angleEnd, angleStart, exADir, exBDir;
  let orthoWaypoints = null;   // user-draggable interior waypoints (Miro-style)
  let orthoVerts = null;       // full vertex list of the right-angle polyline (for segment handles)
  let orthoSegments = null;    // segment midpoints (drag to add a new control point)

  if (shape === 'orthogonal') {
    // Miro-style right-angle routing through ANY number of draggable waypoints.
    // Default: a single midpoint (back-compat with conn.bend). The user can drag each
    // waypoint and add new ones by dragging a segment, while the path stays orthogonal.
    const hwA = A.item ? A.item.w / 2 : 0, hhA = A.item ? A.item.h / 2 : 0;
    const hwB = B.item ? B.item.w / 2 : 0, hhB = B.item ? B.item.h / 2 : 0;
    let ortho = (Array.isArray(conn.ortho) && conn.ortho.length)
      ? conn.ortho.map(p => ({ x: p.x, y: p.y }))
      : [{ x: (cA.x + cB.x) / 2 + (bend.x || 0), y: (cA.y + cB.y) / 2 + (bend.y || 0) }];

    if (ortho.length === 1) {
      const ddx = cB.x - cA.x;
      const ddy = cB.y - cA.y;
      const avgHw = (hwA + hwB) / 2 || 1;
      const avgHh = (hhA + hhB) / 2 || 1;
      if (Math.abs(ddx) / avgHw >= Math.abs(ddy) / avgHh) {
        ortho[0].y = (cA.y + cB.y) / 2;
      } else {
        ortho[0].x = (cA.x + cB.x) / 2;
      }
    }
    orthoWaypoints = ortho;

    const exitFor = (c, hw, hh, hasItem, toward) => {
      const ddx = toward.x - c.x, ddy = toward.y - c.y;
      const normX = hw > 0 ? Math.abs(ddx) / hw : Math.abs(ddx);
      const normY = hh > 0 ? Math.abs(ddy) / hh : Math.abs(ddy);
      if (normX >= normY) {
        const sgn = ddx >= 0 ? 1 : -1;
        const e = { x: c.x + sgn * hw, y: c.y };
        return { e, dir: 'h', p: hasItem ? { x: e.x + sgn * GAP, y: e.y } : { x: e.x, y: e.y } };
      }
      const sgn = ddy >= 0 ? 1 : -1;
      const e = { x: c.x, y: c.y + sgn * hh };
      return { e, dir: 'v', p: hasItem ? { x: e.x, y: e.y + sgn * GAP } : { x: e.x, y: e.y } };
    };

    const exA = exitFor(cA, hwA, hhA, !!A.item, ortho[0]);
    const exB = exitFor(cB, hwB, hhB, !!B.item, ortho[ortho.length - 1]);
    eA = exA.e; eB = exB.e;
    p1 = exA.p; p2 = exB.p;
    exADir = exA.dir;
    exBDir = exB.dir;

    if (ortho.length > 1) {
      const cleaned = cleanOrthoWithEndpoints(ortho, p1, p2, exADir, exBDir);
      if (JSON.stringify(cleaned) !== JSON.stringify(ortho)) {
        ortho = cleaned;
        const newExA = exitFor(cA, hwA, hhA, !!A.item, ortho[0]);
        const newExB = exitFor(cB, hwB, hhB, !!B.item, ortho[ortho.length - 1]);
        eA = newExA.e; eB = newExB.e;
        p1 = newExA.p; p2 = newExB.p;
        exADir = newExA.dir;
        exBDir = newExB.dir;
      }
    }
    orthoWaypoints = ortho;

    // Build a right-angle polyline. Each straight segment records which waypoint
    // coordinate controls it (so dragging the segment moves the WHOLE segment perpendicular,
    // no spikes). wpIndex < 0 means the segment is pinned to a node exit → dragging it inserts
    // a new bend instead of moving an existing point.
    const verts = [p1];
    const segs = []; // { from, to, axis:'x'|'y', wpIndex, insertAfter }
    let prev = p1, dir = exA.dir;
    const pushSeg = (to, axis, wpIndex, insertAfter) => {
      segs.push({ from: prev, to, axis, wpIndex, insertAfter });
      verts.push(to); prev = to;
    };
    for (let k = 0; k < ortho.length; k++) {
      const wp = ortho[k];
      if (dir === 'h') {
        // horizontal first: segment y is controlled by the PREVIOUS waypoint (k-1) or exit
        pushSeg({ x: wp.x, y: prev.y }, 'y', k - 1, k);
        // then vertical: segment x controlled by THIS waypoint (k)
        pushSeg({ x: wp.x, y: wp.y }, 'x', k, k + 1);
      } else {
        pushSeg({ x: prev.x, y: wp.y }, 'x', k - 1, k);
        pushSeg({ x: wp.x, y: wp.y }, 'y', k, k + 1);
      }
      dir = (dir === 'h' ? 'v' : 'h');
    }
    // Final approach into B — must end along B's facing axis (these touch the exit → insert-only)
    if (exB.dir === 'h') {
      pushSeg({ x: prev.x, y: p2.y }, 'x', ortho.length - 1, ortho.length); // vertical, x of last wp
      pushSeg({ x: p2.x, y: p2.y }, 'y', -1, ortho.length);                  // horizontal into B (pinned)
    } else {
      pushSeg({ x: p2.x, y: prev.y }, 'y', ortho.length - 1, ortho.length);
      pushSeg({ x: p2.x, y: p2.y }, 'x', -1, ortho.length);
    }

    orthoVerts = verts;
    // Draggable segment handles — skip near-zero-length stubs.
    orthoSegments = [];
    for (const s of segs) {
      const len = Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y);
      if (len < 10) continue;
      orthoSegments.push({
        from: s.from,
        to: s.to,
        mid: { x: (s.from.x + s.to.x) / 2, y: (s.from.y + s.to.y) / 2 },
        axis: s.axis, wpIndex: s.wpIndex, insertAfter: s.insertAfter,
      });
    }
    // Collapse coincident/collinear points so the path is clean and the arrowhead has a real direction
    const cleanV = [verts[0]];
    for (let i = 1; i < verts.length; i++) {
      const pv = cleanV[cleanV.length - 1];
      if (Math.abs(pv.x - verts[i].x) < 0.5 && Math.abs(pv.y - verts[i].y) < 0.5) continue;
      cleanV.push(verts[i]);
    }
    orthoVerts = cleanV;
    path = 'M ' + cleanV.map(pt => `${pt.x} ${pt.y}`).join(' L ');
    const mid = ortho[Math.floor((ortho.length - 1) / 2)];
    hx = mid.x; hy = mid.y;
    const cn = cleanV.length;
    // Robust arrow angles: use the last/first DISTINCT pair of points.
    angleEnd = cn >= 2 ? Math.atan2(cleanV[cn-1].y - cleanV[cn-2].y, cleanV[cn-1].x - cleanV[cn-2].x) : 0;
    angleStart = cn >= 2 ? Math.atan2(cleanV[0].y - cleanV[1].y, cleanV[0].x - cleanV[1].x) : 0;
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

  const themeInk = theme === 'dark' ? '#F0EEF0' : '#1A1A1A';
  let strokeColor = conn.isColorExplicit ? (conn.color || themeInk) : themeInk;
  if (strokeColor === 'var(--ink)') {
    strokeColor = themeInk;
  }
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

  // Drag a segment PERPENDICULAR only (vertical seg → left/right · horizontal seg → up/down).
  // Moving a segment shifts its controlling waypoint's coordinate, so the whole segment slides
  // without spikes. If the segment is pinned to a node exit (wpIndex < 0), a new bend is inserted.
  const handleSegmentDrag = (seg) => (e) => {
    e.stopPropagation(); e.preventDefault();
    onSelect && onSelect(conn.id);
    const base = (orthoWaypoints || []).map(p => ({ x: p.x, y: p.y }));
    const startX = e.clientX, startY = e.clientY;
    const scale = panZoom?.scale || 1;
    // axis = the coordinate this segment controls ('x' for a vertical segment, 'y' for horizontal)
    const axis = seg.axis;

    // Stable starting array + index for this drag (insert a fresh bend if pinned to an exit)
    let startArr, targetIdx;
    if (seg.wpIndex < 0 || seg.wpIndex >= base.length) {
      const newWp = { x: seg.mid.x, y: seg.mid.y };
      startArr = [...base.slice(0, seg.insertAfter), newWp, ...base.slice(seg.insertAfter)];
      targetIdx = seg.insertAfter;
    } else {
      startArr = base;
      targetIdx = seg.wpIndex;
    }
    const startVal = startArr[targetIdx][axis];

    const onMove = (ev) => {
      const delta = axis === 'x' ? (ev.clientX - startX) / scale : (ev.clientY - startY) / scale;
      let newVal = startVal + delta;

      const SNAP_THRESHOLD = 12;
      let snapTarget = null;
      let minDiff = SNAP_THRESHOLD;

      startArr.forEach((p) => {
        if (Math.abs(p[axis] - startVal) >= 5) {
          const diff = Math.abs(p[axis] - newVal);
          if (diff < minDiff) {
            minDiff = diff;
            snapTarget = p[axis];
          }
        }
      });

      [p1, p2].forEach((pt) => {
        if (pt) {
          const diff = Math.abs(pt[axis] - newVal);
          if (diff < minDiff) {
            minDiff = diff;
            snapTarget = pt[axis];
          }
        }
      });

      if (snapTarget !== null) {
        newVal = snapTarget;
      }

      const next = startArr.map((p) => {
        if (Math.abs(p[axis] - startVal) < 5) {
          return { ...p, [axis]: newVal };
        }
        return p;
      });
      onUpdate(conn.id, { ortho: next, bend: undefined });
    };
    const onUp = (ev) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const delta = axis === 'x' ? (ev.clientX - startX) / scale : (ev.clientY - startY) / scale;
      let newVal = startVal + delta;

      const SNAP_THRESHOLD = 12;
      let snapTarget = null;
      let minDiff = SNAP_THRESHOLD;

      startArr.forEach((p) => {
        if (Math.abs(p[axis] - startVal) >= 5) {
          const diff = Math.abs(p[axis] - newVal);
          if (diff < minDiff) {
            minDiff = diff;
            snapTarget = p[axis];
          }
        }
      });

      [p1, p2].forEach((pt) => {
        if (pt) {
          const diff = Math.abs(pt[axis] - newVal);
          if (diff < minDiff) {
            minDiff = diff;
            snapTarget = pt[axis];
          }
        }
      });

      if (snapTarget !== null) {
        newVal = snapTarget;
      }

      const next = startArr.map((p) => {
        if (Math.abs(p[axis] - startVal) < 5) {
          return { ...p, [axis]: newVal };
        }
        return p;
      });
      onUpdate(conn.id, { ortho: cleanOrthoWithEndpoints(next, p1, p2, exADir, exBDir), bend: undefined });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Drag a waypoint directly to customize the path bends
  const handleWaypointDrag = (idx) => (e) => {
    e.stopPropagation(); e.preventDefault();
    onSelect && onSelect(conn.id);
    const base = (orthoWaypoints || []).map(p => ({ x: p.x, y: p.y }));
    const startX = e.clientX, startY = e.clientY;
    const scale = panZoom?.scale || 1;
    const startPt = { ...base[idx] };

    const onMove = (ev) => {
      const dxp = (ev.clientX - startX) / scale;
      const dyp = (ev.clientY - startY) / scale;
      const next = base.map((p, i) => i === idx ? { x: Math.round(startPt.x + dxp), y: Math.round(startPt.y + dyp) } : p);
      onUpdate(conn.id, { ortho: next, bend: undefined });
    };
    const onUp = (ev) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const dxp = (ev.clientX - startX) / scale;
      const dyp = (ev.clientY - startY) / scale;
      const next = base.map((p, i) => i === idx ? { x: Math.round(startPt.x + dxp), y: Math.round(startPt.y + dyp) } : p);
      onUpdate(conn.id, { ortho: cleanOrthoWithEndpoints(next, p1, p2, exADir, exBDir), bend: undefined });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Double-click a waypoint to remove it (keeps at least one).
  const handleWaypointRemove = (idx) => (e) => {
    e.stopPropagation(); e.preventDefault();
    const base = (orthoWaypoints || []);
    if (base.length <= 1) return;
    const next = base.filter((_, i) => i !== idx).map(p => ({ x: p.x, y: p.y }));
    onUpdate(conn.id, { ortho: cleanOrthoWithEndpoints(next, p1, p2, exADir, exBDir), bend: undefined });
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
    const orthoStarts = (conn.ortho || []).map(p => ({ x: p.x, y: p.y }));
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
      if (orthoStarts.length) {
        const nextOrtho = orthoStarts.map(p => ({ x: p.x + dxp, y: p.y + dyp }));
        onUpdate(conn.id, { ortho: nextOrtho });
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (!moved) { onSelect && onSelect(conn.id); }            // plain click → edit mode
      else {
        if (nodeStarts.length && onDragNodesEnd) onDragNodesEnd(nodeStarts.map(n => n.id)); // commit
        if (orthoStarts.length) {
          onUpdate(conn.id, { ortho: cleanOrthoWithEndpoints(conn.ortho || [], p1, p2, exADir, exBDir) });
        }
      }
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
      
      // Temporarily bypass pointer events on the overlay so we can see the item underneath
      const overlay = document.querySelector('.connectors-top');
      let oldPE = '';
      if (overlay) {
        oldPE = overlay.style.pointerEvents;
        overlay.style.pointerEvents = 'none';
      }
      
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      
      if (overlay) {
        overlay.style.pointerEvents = oldPE;
      }

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
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (shape === 'orthogonal') {
        onUpdate(conn.id, { ortho: cleanOrthoWithEndpoints(conn.ortho || [], p1, p2, exADir, exBDir) });
      }
    };
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
        {shape === 'orthogonal' ? (
          <>
            {/* Per-segment handles — drag anywhere on the segment or its midpoint circle */}
            {orthoSegments && orthoSegments.map((s, i) => (
              <g key={`seg-g-${i}`}>
                <path
                  d={`M ${s.from.x} ${s.from.y} L ${s.to.x} ${s.to.y}`}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                  style={{ cursor: s.axis === 'x' ? 'ew-resize' : 'ns-resize', pointerEvents: 'stroke' }}
                  onMouseDown={handleSegmentDrag(s)}
                />
                <circle
                  className="connector-handle seg-move"
                  cx={s.mid.x} cy={s.mid.y} r={4}
                  style={{ cursor: s.axis === 'x' ? 'ew-resize' : 'ns-resize', pointerEvents: 'all' }}
                  onMouseDown={handleSegmentDrag(s)}
                />
              </g>
            ))}
            {/* Waypoint dots — drag to adjust, double-click to remove a bend */}
            {orthoWaypoints && orthoWaypoints.map((w, i) => (
              <circle key={`wp-${i}`} className="connector-handle waypoint" cx={w.x} cy={w.y} r={5}
                style={{ cursor: 'move' }}
                onMouseDown={handleWaypointDrag(i)}
                onDoubleClick={handleWaypointRemove(i)}/>
            ))}
          </>
        ) : (
          /* Curve bend handle */
          <circle className="connector-handle curve" cx={hx} cy={hy} r={7} onMouseDown={handleCurveDrag}/>
        )}
      </g>
    );
  }

  React.useEffect(() => {
    if (shape === 'orthogonal' && orthoWaypoints) {
      if (JSON.stringify(conn.ortho) !== JSON.stringify(orthoWaypoints)) {
        onUpdate(conn.id, { ortho: orthoWaypoints });
      }
    }
  }, [conn.ortho, orthoWaypoints, shape, conn.id, onUpdate]);

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
