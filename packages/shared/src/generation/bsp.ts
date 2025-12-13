/**
 * Binary Space Partitioning (BSP) Tree Generator
 * Used for procedural building/dungeon generation
 * Deterministic: same seed = same layout
 */
import { SeededRNG } from './rng';
import {
  BSPNode,
  Bounds,
  BSPOptions,
  DEFAULT_BSP_OPTIONS,
} from './types';

/**
 * Generate a BSP tree by recursively splitting a space
 */
export function generateBSPTree(
  width: number,
  height: number,
  rng: SeededRNG,
  options: Partial<BSPOptions> = {}
): BSPNode {
  const opts = { ...DEFAULT_BSP_OPTIONS, ...options };

  const rootBounds: Bounds = { x: 0, y: 0, width, height };

  return splitNode(rootBounds, rng, opts, 0);
}

/**
 * Recursively split a node into two children
 */
function splitNode(
  bounds: Bounds,
  rng: SeededRNG,
  options: BSPOptions,
  depth: number
): BSPNode {
  const node: BSPNode = {
    bounds,
    isLeaf: true,
    depth,
  };

  // Check if we should stop splitting
  if (depth >= options.maxDepth) {
    return node;
  }

  // Check if we can split (both halves must be large enough)
  const canSplitH = bounds.width >= options.minRoomSize * 2 + options.roomMargin * 2;
  const canSplitV = bounds.height >= options.minRoomSize * 2 + options.roomMargin * 2;

  if (!canSplitH && !canSplitV) {
    return node;
  }

  // Decide split direction based on aspect ratio and randomness
  let splitHorizontally: boolean;
  if (!canSplitH) {
    splitHorizontally = false;
  } else if (!canSplitV) {
    splitHorizontally = true;
  } else {
    // Prefer to split the longer dimension with some randomness
    const aspectRatio = bounds.width / bounds.height;
    if (aspectRatio > 1.25) {
      splitHorizontally = rng.nextBoolean(0.8);
    } else if (aspectRatio < 0.8) {
      splitHorizontally = rng.nextBoolean(0.2);
    } else {
      splitHorizontally = rng.nextBoolean(0.5);
    }
  }

  // Calculate split position
  const splitRatio = rng.nextFloat(options.splitRatioMin, options.splitRatioMax);

  let leftBounds: Bounds;
  let rightBounds: Bounds;

  if (splitHorizontally) {
    const splitX = Math.floor(bounds.x + bounds.width * splitRatio);
    leftBounds = {
      x: bounds.x,
      y: bounds.y,
      width: splitX - bounds.x,
      height: bounds.height,
    };
    rightBounds = {
      x: splitX,
      y: bounds.y,
      width: bounds.x + bounds.width - splitX,
      height: bounds.height,
    };
  } else {
    const splitY = Math.floor(bounds.y + bounds.height * splitRatio);
    leftBounds = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: splitY - bounds.y,
    };
    rightBounds = {
      x: bounds.x,
      y: splitY,
      width: bounds.width,
      height: bounds.y + bounds.height - splitY,
    };
  }

  // Validate both halves are large enough
  if (
    leftBounds.width < options.minRoomSize ||
    leftBounds.height < options.minRoomSize ||
    rightBounds.width < options.minRoomSize ||
    rightBounds.height < options.minRoomSize
  ) {
    return node;
  }

  // Create child nodes
  node.isLeaf = false;
  node.left = splitNode(leftBounds, rng, options, depth + 1);
  node.right = splitNode(rightBounds, rng, options, depth + 1);

  return node;
}

/**
 * Get all leaf nodes from a BSP tree
 */
export function getLeafNodes(node: BSPNode): BSPNode[] {
  if (node.isLeaf) {
    return [node];
  }

  const leaves: BSPNode[] = [];
  if (node.left) {
    leaves.push(...getLeafNodes(node.left));
  }
  if (node.right) {
    leaves.push(...getLeafNodes(node.right));
  }
  return leaves;
}

/**
 * Get total number of leaf nodes
 */
export function countLeafNodes(node: BSPNode): number {
  return getLeafNodes(node).length;
}

/**
 * Get maximum depth of tree
 */
export function getTreeDepth(node: BSPNode): number {
  if (node.isLeaf) {
    return node.depth;
  }

  let maxDepth = node.depth;
  if (node.left) {
    maxDepth = Math.max(maxDepth, getTreeDepth(node.left));
  }
  if (node.right) {
    maxDepth = Math.max(maxDepth, getTreeDepth(node.right));
  }
  return maxDepth;
}

/**
 * Traverse tree in order
 */
export function traverseBSP(
  node: BSPNode,
  callback: (node: BSPNode) => void
): void {
  callback(node);
  if (node.left) traverseBSP(node.left, callback);
  if (node.right) traverseBSP(node.right, callback);
}

/**
 * Find a sibling node (shares same parent)
 */
export function findSibling(root: BSPNode, target: BSPNode): BSPNode | null {
  function search(node: BSPNode): BSPNode | null {
    if (!node.left || !node.right) return null;

    if (node.left === target) return node.right;
    if (node.right === target) return node.left;

    const leftResult = search(node.left);
    if (leftResult) return leftResult;

    return search(node.right);
  }

  return search(root);
}

/**
 * Get node at specific position
 */
export function getNodeAtPosition(
  node: BSPNode,
  x: number,
  y: number
): BSPNode | null {
  const { bounds } = node;

  // Check if point is within bounds
  if (
    x < bounds.x ||
    x >= bounds.x + bounds.width ||
    y < bounds.y ||
    y >= bounds.y + bounds.height
  ) {
    return null;
  }

  // If leaf, return this node
  if (node.isLeaf) {
    return node;
  }

  // Check children
  if (node.left) {
    const leftResult = getNodeAtPosition(node.left, x, y);
    if (leftResult) return leftResult;
  }
  if (node.right) {
    const rightResult = getNodeAtPosition(node.right, x, y);
    if (rightResult) return rightResult;
  }

  return node;
}

/**
 * Validate BSP tree properties
 */
export function validateBSPTree(root: BSPNode): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  function validate(node: BSPNode): void {
    // Check bounds are positive
    if (node.bounds.width <= 0 || node.bounds.height <= 0) {
      errors.push(`Node at depth ${node.depth} has invalid bounds`);
    }

    // Check children are within parent bounds
    if (node.left) {
      if (!isWithinBounds(node.left.bounds, node.bounds)) {
        errors.push(`Left child at depth ${node.depth + 1} is outside parent bounds`);
      }
      validate(node.left);
    }

    if (node.right) {
      if (!isWithinBounds(node.right.bounds, node.bounds)) {
        errors.push(`Right child at depth ${node.depth + 1} is outside parent bounds`);
      }
      validate(node.right);
    }

    // Check non-leaf nodes have children
    if (!node.isLeaf && (!node.left || !node.right)) {
      errors.push(`Non-leaf node at depth ${node.depth} missing children`);
    }
  }

  validate(root);

  return {
    valid: errors.length === 0,
    errors,
  };
}

function isWithinBounds(inner: Bounds, outer: Bounds): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

export default generateBSPTree;
