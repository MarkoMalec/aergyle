import { compareItems, inputsOf, outputsOf, type GraphLink, type ItemGraph } from "./graph";

/**
 * The focus lens: the part of the item graph around one item that is on
 * screen. Needs spread to the left of the focus, uses to the right, so
 * materials always flow left to right. Depth limits, per-branch expand and
 * collapse and a fan-out cap keep it readable whatever the size of the graph.
 */

export type LensSide = "up" | "down";

export type LensOptions = {
  up: number;
  down: number;
  /** `${side}:${itemId}` of items opened one level past the depth limit. */
  expanded: ReadonlySet<string>;
  /** `${side}:${itemId}` of items whose branch is closed. */
  collapsed: ReadonlySet<string>;
  /** `${side}:${itemId}` of items listing every neighbour past the fan-out cap. */
  showAll: ReadonlySet<string>;
  fanOut: number;
  /** Items left out (filters in hide mode); the focus always shows. */
  hidden?: (itemId: number) => boolean;
};

export const LENS_DEFAULTS = { up: 2, down: 1, fanOut: 8 } as const;
export const MAX_LENS_DEPTH = 8;

export const NODE_WIDTH = 216;
export const NODE_MIN_HEIGHT = 58;
export const PORT_SPACING = 18;
export const MORE_HEIGHT = 34;
export const COLUMN_GAP = 132;
export const ROW_GAP = 14;
export const COLUMN_PITCH = NODE_WIDTH + COLUMN_GAP;

export type LensItemNode = {
  key: string;
  type: "item";
  itemId: number;
  side: "up" | "focus" | "down";
  column: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Neighbours off screen, per direction: the +N handles. */
  hiddenUp: number;
  hiddenDown: number;
  /** The branch in that direction is open, so it can be collapsed. */
  openUp: boolean;
  openDown: boolean;
};

/** Stands for the neighbours past the fan-out cap. */
export type LensMoreNode = {
  key: string;
  type: "more";
  parentId: number;
  side: LensSide;
  count: number;
  column: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LensNode = LensItemNode | LensMoreNode;

export type LensEdge = {
  key: string;
  from: string;
  to: string;
  /** Null for the link to a "more" node. */
  link: GraphLink | null;
  /** Points right to left: part of a circular dependency. */
  backward: boolean;
  /** Input slot on the target's left side, top to bottom. */
  port: number;
  ports: number;
};

export type Lens = {
  focusKey: string;
  nodes: LensNode[];
  edges: LensEdge[];
  minColumn: number;
  maxColumn: number;
  bounds: { x: number; y: number; width: number; height: number };
};

export const itemKey = (itemId: number) => `i${itemId}`;
export const branchKey = (side: LensSide, itemId: number) => `${side}:${itemId}`;

function unique(ids: number[]) {
  return [...new Set(ids)];
}

export function buildLens(graph: ItemGraph, focusId: number, options: LensOptions): Lens {
  const hidden = options.hidden ?? (() => false);
  const side = new Map<number, LensItemNode["side"]>([[focusId, "focus"]]);
  const discovery = new Map<string, number>([[itemKey(focusId), 0]]);
  const opened = { up: new Set<number>(), down: new Set<number>() };
  const mores: Array<Omit<LensMoreNode, "x" | "y" | "width" | "height" | "column">> = [];

  const neighbours = (dir: LensSide, id: number) =>
    unique(
      dir === "up"
        ? inputsOf(graph, id).map((link) => link.from)
        : outputsOf(graph, id).map((link) => link.to),
    );

  const explore = (dir: LensSide, limit: number) => {
    const distance = new Map([[focusId, 0]]);
    const queue = [focusId];
    // Breadth first: the loop also visits what it pushes.
    for (const id of queue) {
      const depth = distance.get(id)!;
      const key = branchKey(dir, id);
      const open =
        id === focusId
          ? limit > 0
          : !options.collapsed.has(key) && (depth < limit || options.expanded.has(key));
      if (!open) continue;
      opened[dir].add(id);
      const fresh = neighbours(dir, id)
        .filter((n) => !side.has(n) && !hidden(n))
        .sort((a, b) => compareItems(graph, a, b, dir));
      const cap = options.showAll.has(key) ? Infinity : Math.max(1, options.fanOut);
      for (const n of fresh.slice(0, cap)) {
        side.set(n, dir);
        discovery.set(itemKey(n), discovery.size);
        distance.set(n, depth + 1);
        queue.push(n);
      }
      if (fresh.length > cap) {
        const key = `m${dir}${id}`;
        mores.push({ key, type: "more", parentId: id, side: dir, count: fresh.length - cap });
        discovery.set(key, discovery.get(itemKey(id))! + 0.5);
      }
    }
  };
  explore("up", options.up);
  explore("down", options.down);

  // Columns: the longest path to the focus inside the lens, so every link
  // points right and a shared input sits once, left of all its uses.
  const depthOf = (dir: LensSide) => {
    const memo = new Map<number, number>([[focusId, 0]]);
    const visiting = new Set<number>();
    const walk = (id: number): number => {
      const known = memo.get(id);
      if (known !== undefined) return known;
      if (visiting.has(id)) return -1;
      visiting.add(id);
      let best = 1;
      const links = dir === "up" ? outputsOf(graph, id) : inputsOf(graph, id);
      for (const link of links) {
        const next = dir === "up" ? link.to : link.from;
        const nextSide = side.get(next);
        if (nextSide !== dir && nextSide !== "focus") continue;
        const d = walk(next);
        if (d >= 0) best = Math.max(best, d + 1);
      }
      visiting.delete(id);
      memo.set(id, best);
      return best;
    };
    return walk;
  };
  const upDepth = depthOf("up");
  const downDepth = depthOf("down");

  const column = new Map<string, number>();
  const nodes = new Map<string, LensNode>();
  for (const [id, s] of side) {
    const col = s === "focus" ? 0 : s === "up" ? -upDepth(id) : downDepth(id);
    const key = itemKey(id);
    column.set(key, col);
    const hiddenCount = (dir: LensSide) =>
      neighbours(dir, id).filter((n) => !side.has(n) && !hidden(n)).length;
    nodes.set(key, {
      key,
      type: "item",
      itemId: id,
      side: s,
      column: col,
      x: 0,
      y: 0,
      width: NODE_WIDTH,
      height: NODE_MIN_HEIGHT,
      hiddenUp: s === "down" ? 0 : hiddenCount("up"),
      hiddenDown: s === "up" ? 0 : hiddenCount("down"),
      openUp: opened.up.has(id),
      openDown: opened.down.has(id),
    });
  }
  for (const more of mores) {
    const col = column.get(itemKey(more.parentId))! + (more.side === "up" ? -1 : 1);
    column.set(more.key, col);
    nodes.set(more.key, { ...more, column: col, x: 0, y: 0, width: NODE_WIDTH, height: MORE_HEIGHT });
  }

  // Every link between two items on screen, including ones the traversal did
  // not take: they show where branches merge.
  const edges: LensEdge[] = [];
  for (const [id] of side) {
    for (const link of inputsOf(graph, id)) {
      if (!side.has(link.from)) continue;
      const from = itemKey(link.from);
      const to = itemKey(id);
      edges.push({
        key: `${from}-${to}-${link.kind}`,
        from,
        to,
        link,
        backward: column.get(from)! >= column.get(to)!,
        port: 0,
        ports: 1,
      });
    }
  }
  for (const more of mores) {
    const parent = itemKey(more.parentId);
    const [from, to] = more.side === "up" ? [more.key, parent] : [parent, more.key];
    edges.push({ key: `${from}-${to}`, from, to, link: null, backward: false, port: 0, ports: 1 });
  }

  // Taller nodes for more inputs, so each quantity gets its own slot.
  const incoming = new Map<string, LensEdge[]>();
  for (const edge of edges) {
    const list = incoming.get(edge.to);
    if (list) list.push(edge);
    else incoming.set(edge.to, [edge]);
  }
  for (const [key, list] of incoming) {
    const node = nodes.get(key)!;
    if (node.type === "item") {
      node.height = Math.max(NODE_MIN_HEIGHT, list.length * PORT_SPACING + 16);
    }
  }

  const { minColumn, maxColumn } = placeNodes(nodes, edges, column, discovery);

  for (const list of incoming.values()) {
    const centre = (edge: LensEdge) => {
      const node = nodes.get(edge.from)!;
      return (edge.backward ? 1e9 : 0) + node.y + node.height / 2;
    };
    list.sort((a, b) => centre(a) - centre(b));
    list.forEach((edge, i) => {
      edge.port = i;
      edge.ports = list.length;
    });
  }

  const all = [...nodes.values()];
  const minX = Math.min(...all.map((n) => n.x));
  const minY = Math.min(...all.map((n) => n.y));
  const maxX = Math.max(...all.map((n) => n.x + n.width));
  const maxY = Math.max(...all.map((n) => n.y + n.height));

  return {
    focusKey: itemKey(focusId),
    nodes: all,
    edges,
    minColumn,
    maxColumn,
    bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
  };
}

/**
 * Orders each column to reduce crossings (barycenter sweeps outward from the
 * focus and back), then places nodes as close as possible to the neighbours
 * they link toward the focus, keeping the column's order and spacing.
 */
function placeNodes(
  nodes: Map<string, LensNode>,
  edges: LensEdge[],
  column: Map<string, number>,
  discovery: Map<string, number>,
) {
  const adjacent = new Map<string, string[]>();
  for (const key of nodes.keys()) adjacent.set(key, []);
  for (const edge of edges) {
    if (edge.backward) continue;
    adjacent.get(edge.from)!.push(edge.to);
    adjacent.get(edge.to)!.push(edge.from);
  }

  const columns = new Map<number, string[]>();
  for (const key of [...nodes.keys()].sort((a, b) => discovery.get(a)! - discovery.get(b)!)) {
    const c = column.get(key)!;
    const list = columns.get(c);
    if (list) list.push(key);
    else columns.set(c, [key]);
  }
  const minColumn = Math.min(...columns.keys());
  const maxColumn = Math.max(...columns.keys());

  const rank = new Map<string, number>();
  const refreshRanks = (c: number) => {
    const list = columns.get(c) ?? [];
    list.forEach((key, i) => rank.set(key, i - (list.length - 1) / 2));
  };
  for (const c of columns.keys()) refreshRanks(c);

  // Links that cross the focus (a need that is also used further right) are
  // left out: they would pull a node toward the other side.
  const towardFocus = (c: number, other: number) =>
    c < 0 ? other > c && other <= 0 : other < c && other >= 0;
  const reorder = (c: number, inward: boolean) => {
    const list = columns.get(c);
    if (!list || list.length < 2) return;
    const barycenter = new Map<string, number>();
    for (const key of list) {
      const refs = adjacent
        .get(key)!
        .filter((n) => {
          const other = column.get(n)!;
          return other !== c && (inward ? !towardFocus(c, other) && Math.sign(other) === Math.sign(c) : towardFocus(c, other));
        });
      barycenter.set(
        key,
        refs.length > 0
          ? refs.reduce((sum, n) => sum + rank.get(n)!, 0) / refs.length
          : rank.get(key)!,
      );
    }
    list.sort((a, b) => barycenter.get(a)! - barycenter.get(b)! || rank.get(a)! - rank.get(b)!);
    refreshRanks(c);
  };
  const outwardOrder = [
    ...Array.from({ length: -minColumn }, (_, i) => -1 - i),
    ...Array.from({ length: maxColumn }, (_, i) => 1 + i),
  ];
  const inwardOrder = [
    ...Array.from({ length: Math.max(0, -minColumn - 1) }, (_, i) => minColumn + 1 + i),
    ...Array.from({ length: Math.max(0, maxColumn - 1) }, (_, i) => maxColumn - 1 - i),
  ];
  for (let pass = 0; pass < 3; pass += 1) {
    for (const c of outwardOrder) reorder(c, false);
    if (pass < 2) for (const c of inwardOrder) reorder(c, true);
  }

  const centre = (key: string) => {
    const node = nodes.get(key)!;
    return node.y + node.height / 2;
  };
  const placeColumn = (c: number) => {
    const list = columns.get(c) ?? [];
    const desired = list.map((key) => {
      const refs = adjacent
        .get(key)!
        .filter((n) => column.get(n) !== c && towardFocus(c, column.get(n)!));
      return refs.length > 0 ? refs.reduce((sum, n) => sum + centre(n), 0) / refs.length : null;
    });
    let cursor = -Infinity;
    let drift = 0;
    let anchored = 0;
    list.forEach((key, i) => {
      const node = nodes.get(key)!;
      const want = desired[i] ?? (cursor === -Infinity ? 0 : cursor + node.height / 2);
      node.y = Math.max(want - node.height / 2, cursor);
      cursor = node.y + node.height + ROW_GAP;
      if (desired[i] !== null) {
        drift += want - node.height / 2 - node.y;
        anchored += 1;
      }
    });
    // Shifting the whole column keeps its order and gaps while centring it
    // on the neighbours it hangs from.
    const shift = anchored > 0 ? drift / anchored : 0;
    for (const key of list) {
      const node = nodes.get(key)!;
      node.y += shift;
      node.x = c * COLUMN_PITCH;
    }
  };

  const focusColumn = columns.get(0) ?? [];
  let cursor = 0;
  for (const key of focusColumn) {
    const node = nodes.get(key)!;
    node.x = 0;
    node.y = cursor;
    cursor += node.height + ROW_GAP;
  }
  const focusShift = (cursor - ROW_GAP) / 2;
  for (const key of focusColumn) nodes.get(key)!.y -= focusShift;
  for (const c of outwardOrder) placeColumn(c);

  return { minColumn, maxColumn };
}

/** Everything upstream and downstream of a node, following the lens's links. */
export function lensLineage(lens: Lens, key: string) {
  const forward = new Map<string, LensEdge[]>();
  const backward = new Map<string, LensEdge[]>();
  for (const edge of lens.edges) {
    forward.set(edge.from, [...(forward.get(edge.from) ?? []), edge]);
    backward.set(edge.to, [...(backward.get(edge.to) ?? []), edge]);
  }
  const nodes = new Set([key]);
  const edges = new Set<string>();
  const walk = (start: string, next: Map<string, LensEdge[]>, pick: (e: LensEdge) => string) => {
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length > 0) {
      for (const edge of next.get(queue.pop()!) ?? []) {
        edges.add(edge.key);
        const n = pick(edge);
        nodes.add(n);
        if (!seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
  };
  walk(key, backward, (edge) => edge.from);
  walk(key, forward, (edge) => edge.to);
  return { nodes, edges };
}
