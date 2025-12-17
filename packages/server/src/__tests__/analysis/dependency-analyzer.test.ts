import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyAnalyzer } from '../../analysis/dependency-analyzer';

describe('DependencyAnalyzer', () => {
  let analyzer: DependencyAnalyzer;

  beforeEach(() => {
    analyzer = new DependencyAnalyzer();
  });

  describe('parseImports', () => {
    describe('JavaScript/TypeScript', () => {
      it('should parse ES6 import statements', () => {
        const content = `
          import React from 'react';
          import { useState, useEffect } from 'react';
          import * as utils from './utils';
          import type { User } from './types';
        `;

        const imports = analyzer.parseImports(content, 'src/App.tsx');
        expect(imports).toContain('react');
        expect(imports).toContain('./utils');
        expect(imports).toContain('./types');
      });

      it('should parse CommonJS require statements', () => {
        const content = `
          const express = require('express');
          const router = require('./routes');
          const { db } = require('./database');
        `;

        const imports = analyzer.parseImports(content, 'src/server.js');
        expect(imports).toContain('express');
        expect(imports).toContain('./routes');
        expect(imports).toContain('./database');
      });

      it('should parse dynamic imports', () => {
        const content = `
          const module = await import('./lazy-module');
          import('./another-module').then(mod => console.log(mod));
        `;

        const imports = analyzer.parseImports(content, 'src/index.js');
        expect(imports).toContain('./lazy-module');
        expect(imports).toContain('./another-module');
      });

      it('should handle mixed import styles', () => {
        const content = `
          import React from 'react';
          const express = require('express');
          await import('./dynamic');
        `;

        const imports = analyzer.parseImports(content, 'src/mixed.ts');
        expect(imports).toContain('react');
        expect(imports).toContain('express');
        expect(imports).toContain('./dynamic');
      });
    });

    describe('Python', () => {
      it('should parse Python import statements', () => {
        const content = `
import os
import sys
import json
        `;

        const imports = analyzer.parseImports(content, 'main.py');
        expect(imports).toContain('os');
        expect(imports).toContain('sys');
        expect(imports).toContain('json');
      });

      it('should parse Python from-import statements', () => {
        const content = `
from django.http import HttpResponse
from .models import User, Post
from ..utils import helper
        `;

        const imports = analyzer.parseImports(content, 'views.py');
        expect(imports).toContain('django.http');
        expect(imports).toContain('.models');
        expect(imports).toContain('..utils');
      });

      it('should parse mixed Python imports', () => {
        const content = `
import numpy as np
from typing import List, Dict
from .database import db
        `;

        const imports = analyzer.parseImports(content, 'app.py');
        expect(imports).toContain('numpy');
        expect(imports).toContain('typing');
        expect(imports).toContain('.database');
      });
    });

    describe('Go', () => {
      it('should parse Go single imports', () => {
        const content = `
package main

import "fmt"
import "net/http"
        `;

        const imports = analyzer.parseImports(content, 'main.go');
        expect(imports).toContain('fmt');
        expect(imports).toContain('net/http');
      });

      it('should parse Go multi-line imports', () => {
        const content = `
package main

import (
    "fmt"
    "net/http"
    "encoding/json"
    "github.com/user/package"
)
        `;

        const imports = analyzer.parseImports(content, 'main.go');
        expect(imports).toContain('fmt');
        expect(imports).toContain('net/http');
        expect(imports).toContain('encoding/json');
        expect(imports).toContain('github.com/user/package');
      });

      it('should handle aliased Go imports', () => {
        const content = `
import (
    f "fmt"
    h "net/http"
)
        `;

        const imports = analyzer.parseImports(content, 'main.go');
        expect(imports).toContain('fmt');
        expect(imports).toContain('net/http');
      });
    });

    describe('Rust', () => {
      it('should parse Rust use statements', () => {
        const content = `
use std::io;
use std::collections::HashMap;
use crate::models::User;
        `;

        const imports = analyzer.parseImports(content, 'main.rs');
        expect(imports).toContain('std::io');
        expect(imports).toContain('std::collections::HashMap');
        expect(imports).toContain('crate::models::User');
      });

      it('should parse Rust extern crate', () => {
        const content = `
extern crate serde;
extern crate tokio;
        `;

        const imports = analyzer.parseImports(content, 'lib.rs');
        expect(imports).toContain('serde');
        expect(imports).toContain('tokio');
      });
    });

    describe('Java', () => {
      it('should parse Java import statements', () => {
        const content = `
package com.example;

import java.util.List;
import java.util.ArrayList;
import com.example.models.User;
        `;

        const imports = analyzer.parseImports(content, 'Main.java');
        expect(imports).toContain('java.util.List');
        expect(imports).toContain('java.util.ArrayList');
        expect(imports).toContain('com.example.models.User');
      });

      it('should parse Java wildcard imports', () => {
        const content = `
import java.util.*;
import com.example.models.*;
        `;

        const imports = analyzer.parseImports(content, 'App.java');
        // The parser captures up to the wildcard
        expect(imports.some((imp) => imp.includes('java.util'))).toBe(true);
        expect(imports.some((imp) => imp.includes('com.example.models'))).toBe(true);
      });
    });
  });

  describe('buildDependencyGraph', () => {
    it('should build graph from file contents', () => {
      const files = new Map<string, string>([
        [
          '/src/a.ts',
          `
          import { funcB } from './b';
          import { funcC } from './c';
        `,
        ],
        [
          '/src/b.ts',
          `
          import { funcC } from './c';
        `,
        ],
        ['/src/c.ts', 'export const funcC = () => {};'],
      ]);

      const graph = analyzer.buildDependencyGraph(files);

      expect(graph.nodes.size).toBe(3);
      expect(graph.edges.length).toBeGreaterThan(0);
    });

    it('should calculate coupling correctly', () => {
      const files = new Map<string, string>([
        [
          '/src/a.ts',
          `
          import { b } from './b';
          import { c } from './c';
        `,
        ],
        ['/src/b.ts', 'export const b = 1;'],
        ['/src/c.ts', 'export const c = 2;'],
      ]);

      const graph = analyzer.buildDependencyGraph(files);

      const nodeA = graph.nodes.get('/src/a.ts');
      expect(nodeA).toBeDefined();
      expect(nodeA!.coupling).toBeGreaterThan(0);
    });

    it('should track imports and importedBy', () => {
      const files = new Map<string, string>([
        ['/src/a.ts', `import { b } from './b';`],
        ['/src/b.ts', 'export const b = 1;'],
      ]);

      const graph = analyzer.buildDependencyGraph(files);

      const nodeB = graph.nodes.get('/src/b.ts');

      expect(nodeB?.importedBy).toContain('/src/a.ts');
    });

    it('should handle files with no dependencies', () => {
      const files = new Map<string, string>([['/src/isolated.ts', 'export const x = 1;']]);

      const graph = analyzer.buildDependencyGraph(files);

      const node = graph.nodes.get('/src/isolated.ts');
      expect(node).toBeDefined();
      expect(node!.imports).toHaveLength(0);
      expect(node!.importedBy).toHaveLength(0);
      expect(node!.coupling).toBe(0);
    });
  });

  describe('detectCircularDependencies', () => {
    it('should detect simple circular dependency (A -> B -> A)', () => {
      const files = new Map<string, string>([
        ['/src/a.ts', `import { b } from './b';`],
        ['/src/b.ts', `import { a } from './a';`],
      ]);

      const graph = analyzer.buildDependencyGraph(files);
      const circular = analyzer.detectCircularDependencies(graph);

      expect(circular.length).toBeGreaterThan(0);
      // Cycle includes both nodes plus the return to first, so length is 3, making it medium severity
      expect(circular[0].severity).toBe('medium');
    });

    it('should detect complex circular dependency (A -> B -> C -> A)', () => {
      const files = new Map<string, string>([
        ['/src/a.ts', `import { b } from './b';`],
        ['/src/b.ts', `import { c } from './c';`],
        ['/src/c.ts', `import { a } from './a';`],
      ]);

      const graph = analyzer.buildDependencyGraph(files);
      const circular = analyzer.detectCircularDependencies(graph);

      expect(circular.length).toBeGreaterThan(0);
      expect(circular[0].cycle.length).toBeGreaterThan(2);
    });

    it('should assign severity based on cycle length', () => {
      const files = new Map<string, string>([
        ['/src/a.ts', `import { b } from './b';`],
        ['/src/b.ts', `import { c } from './c';`],
        ['/src/c.ts', `import { d } from './d';`],
        ['/src/d.ts', `import { e } from './e';`],
        ['/src/e.ts', `import { a } from './a';`],
      ]);

      const graph = analyzer.buildDependencyGraph(files);
      const circular = analyzer.detectCircularDependencies(graph);

      expect(circular.length).toBeGreaterThan(0);
      expect(circular[0].severity).toBe('high'); // 5+ file cycle
    });

    it('should return empty array for acyclic graph', () => {
      const files = new Map<string, string>([
        ['/src/a.ts', `import { b } from './b';`],
        ['/src/b.ts', `import { c } from './c';`],
        ['/src/c.ts', 'export const c = 1;'],
      ]);

      const graph = analyzer.buildDependencyGraph(files);
      const circular = analyzer.detectCircularDependencies(graph);

      expect(circular).toHaveLength(0);
    });
  });

  describe('calculateMetrics', () => {
    it('should calculate comprehensive metrics', () => {
      const files = new Map<string, string>([
        [
          '/src/a.ts',
          `
          import { b } from './b';
          import { c } from './c';
        `,
        ],
        ['/src/b.ts', `import { c } from './c';`],
        ['/src/c.ts', 'export const c = 1;'],
        ['/src/isolated.ts', 'export const x = 1;'],
      ]);

      const graph = analyzer.buildDependencyGraph(files);
      const metrics = analyzer.calculateMetrics(graph);

      expect(metrics.totalModules).toBe(4);
      expect(metrics.averageCoupling).toBeGreaterThanOrEqual(0);
      expect(metrics.maxCoupling).toBeGreaterThanOrEqual(0);
      expect(metrics.isolatedModules).toContain('/src/isolated.ts');
    });

    it('should identify high coupling modules', () => {
      const files = new Map<string, string>([
        [
          '/src/hub.ts',
          `
          import { a } from './a';
          import { b } from './b';
          import { c } from './c';
          import { d } from './d';
        `,
        ],
        ['/src/a.ts', `import { hub } from './hub';`],
        ['/src/b.ts', `import { hub } from './hub';`],
        ['/src/c.ts', `import { hub } from './hub';`],
        ['/src/d.ts', `import { hub } from './hub';`],
      ]);

      const graph = analyzer.buildDependencyGraph(files);
      const metrics = analyzer.calculateMetrics(graph);

      expect(metrics.highCouplingModules.length).toBeGreaterThan(0);
      expect(metrics.highCouplingModules[0].file).toBe('/src/hub.ts');
    });

    it('should detect isolated modules', () => {
      const files = new Map<string, string>([
        ['/src/connected.ts', `import { x } from './other';`],
        ['/src/other.ts', 'export const x = 1;'],
        ['/src/isolated1.ts', 'export const a = 1;'],
        ['/src/isolated2.ts', 'export const b = 2;'],
      ]);

      const graph = analyzer.buildDependencyGraph(files);
      const metrics = analyzer.calculateMetrics(graph);

      expect(metrics.isolatedModules.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('exportGraph', () => {
    it('should export graph in standard format', () => {
      const files = new Map<string, string>([
        ['/src/a.ts', `import { b } from './b';`],
        ['/src/b.ts', 'export const b = 1;'],
      ]);

      const graph = analyzer.buildDependencyGraph(files);
      const exported = analyzer.exportGraph(graph);

      expect(exported.nodes).toBeDefined();
      expect(exported.edges).toBeDefined();
      expect(exported.nodes.length).toBeGreaterThan(0);
      expect(exported.edges.length).toBeGreaterThan(0);
    });

    it('should include coupling in exported nodes', () => {
      const files = new Map<string, string>([
        [
          '/src/a.ts',
          `
          import { b } from './b';
          import { c } from './c';
        `,
        ],
        ['/src/b.ts', 'export const b = 1;'],
        ['/src/c.ts', 'export const c = 1;'],
      ]);

      const graph = analyzer.buildDependencyGraph(files);
      const exported = analyzer.exportGraph(graph);

      const nodeA = exported.nodes.find((n) => n.id === '/src/a.ts');
      expect(nodeA).toBeDefined();
      expect(nodeA!.coupling).toBeGreaterThan(0);
    });
  });

  describe('findDependents and findDependencies', () => {
    it('should find direct dependents', () => {
      const files = new Map<string, string>([
        ['/src/a.ts', `import { util } from './util';`],
        ['/src/b.ts', `import { util } from './util';`],
        ['/src/util.ts', 'export const util = 1;'],
      ]);

      const graph = analyzer.buildDependencyGraph(files);
      const dependents = analyzer.findDependents(graph, '/src/util.ts');

      expect(dependents).toContain('/src/a.ts');
      expect(dependents).toContain('/src/b.ts');
    });

    it('should find direct dependencies', () => {
      const files = new Map<string, string>([
        [
          '/src/a.ts',
          `
          import { b } from './b';
          import { c } from './c';
        `,
        ],
        ['/src/b.ts', 'export const b = 1;'],
        ['/src/c.ts', 'export const c = 1;'],
      ]);

      const graph = analyzer.buildDependencyGraph(files);
      const dependencies = analyzer.findDependencies(graph, '/src/a.ts');

      expect(dependencies.length).toBe(2);
    });
  });

  describe('getTransitiveDependencies', () => {
    it('should find all transitive dependencies', () => {
      const files = new Map<string, string>([
        ['/src/a.ts', `import { b } from './b';`],
        ['/src/b.ts', `import { c } from './c';`],
        ['/src/c.ts', `import { d } from './d';`],
        ['/src/d.ts', 'export const d = 1;'],
      ]);

      const graph = analyzer.buildDependencyGraph(files);
      const transitive = analyzer.getTransitiveDependencies(graph, '/src/a.ts');

      expect(transitive.size).toBeGreaterThan(1);
      expect(transitive.has('/src/a.ts')).toBe(false); // Should not include self
    });

    it('should respect maxDepth parameter', () => {
      const files = new Map<string, string>([
        ['/src/a.ts', `import { b } from './b';`],
        ['/src/b.ts', `import { c } from './c';`],
        ['/src/c.ts', `import { d } from './d';`],
        ['/src/d.ts', 'export const d = 1;'],
      ]);

      const graph = analyzer.buildDependencyGraph(files);
      const transitive = analyzer.getTransitiveDependencies(graph, '/src/a.ts', 2);

      // With depth 2, should only get b and c, not d
      expect(transitive.size).toBeLessThanOrEqual(2);
    });

    it('should handle circular dependencies without infinite loop', () => {
      const files = new Map<string, string>([
        ['/src/a.ts', `import { b } from './b';`],
        ['/src/b.ts', `import { c } from './c';`],
        ['/src/c.ts', `import { a } from './a';`],
      ]);

      const graph = analyzer.buildDependencyGraph(files);

      // Should not hang or crash
      const transitive = analyzer.getTransitiveDependencies(graph, '/src/a.ts');
      expect(transitive.size).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty file map', () => {
      const files = new Map<string, string>();
      const graph = analyzer.buildDependencyGraph(files);

      expect(graph.nodes.size).toBe(0);
      expect(graph.edges).toHaveLength(0);
    });

    it('should handle file with syntax errors gracefully', () => {
      const files = new Map<string, string>([
        ['/src/broken.ts', 'import { broken from missing quote'],
        ['/src/normal.ts', 'export const x = 1;'],
      ]);

      // Should not throw
      const graph = analyzer.buildDependencyGraph(files);
      expect(graph.nodes.size).toBe(2);
    });

    it('should handle imports to non-existent files', () => {
      const files = new Map<string, string>([
        ['/src/a.ts', `import { missing } from './missing';`],
      ]);

      const graph = analyzer.buildDependencyGraph(files);

      // Should have node but edge to missing file should not be created
      expect(graph.nodes.size).toBe(1);
    });

    it('should skip external package imports', () => {
      const files = new Map<string, string>([
        [
          '/src/a.ts',
          `
          import React from 'react';
          import { useState } from 'react';
          import express from 'express';
        `,
        ],
      ]);

      const graph = analyzer.buildDependencyGraph(files);
      const node = graph.nodes.get('/src/a.ts');

      // External imports should not create edges
      expect(node!.imports).toHaveLength(0);
    });
  });
});
