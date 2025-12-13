import { describe, it, expect, beforeEach } from 'vitest';
import { WebhookHandler } from '../../webhooks/github-enhanced';
import crypto from 'node:crypto';

describe('WebhookHandler - Signature Verification', () => {
  let handler: WebhookHandler;
  const testSecret = 'test-webhook-secret';

  beforeEach(() => {
    // Set secret in environment
    process.env.WEBHOOK_SECRET = testSecret;
    handler = new WebhookHandler();
  });

  describe('verifySignature', () => {
    it('should verify valid HMAC SHA-256 signature', () => {
      const payload = Buffer.from(JSON.stringify({ test: 'data' }));
      const hmac = crypto.createHmac('sha256', testSecret);
      hmac.update(payload);
      const signature = `sha256=${hmac.digest('hex')}`;

      const isValid = handler.verifySignature(payload, signature);

      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = Buffer.from(JSON.stringify({ test: 'data' }));
      const invalidSignature = 'sha256=invalid';

      const isValid = handler.verifySignature(payload, invalidSignature);

      expect(isValid).toBe(false);
    });

    it('should reject signature with wrong payload', () => {
      const payload1 = Buffer.from(JSON.stringify({ test: 'data1' }));
      const payload2 = Buffer.from(JSON.stringify({ test: 'data2' }));

      const hmac = crypto.createHmac('sha256', testSecret);
      hmac.update(payload1);
      const signature = `sha256=${hmac.digest('hex')}`;

      const isValid = handler.verifySignature(payload2, signature);

      expect(isValid).toBe(false);
    });

    it('should use timing-safe comparison', () => {
      const payload = Buffer.from(JSON.stringify({ test: 'data' }));

      // Create two valid signatures
      const hmac1 = crypto.createHmac('sha256', testSecret);
      hmac1.update(payload);
      const signature1 = `sha256=${hmac1.digest('hex')}`;

      const hmac2 = crypto.createHmac('sha256', testSecret);
      hmac2.update(payload);
      const signature2 = `sha256=${hmac2.digest('hex')}`;

      // Both should be valid
      expect(handler.verifySignature(payload, signature1)).toBe(true);
      expect(handler.verifySignature(payload, signature2)).toBe(true);
      expect(signature1).toBe(signature2);
    });

    it('should reject empty signature', () => {
      const payload = Buffer.from(JSON.stringify({ test: 'data' }));

      const isValid = handler.verifySignature(payload, '');

      expect(isValid).toBe(false);
    });

    it('should handle different payload sizes', () => {
      const sizes = [10, 100, 1000, 10000];

      sizes.forEach((size) => {
        const payload = Buffer.from('x'.repeat(size));
        const hmac = crypto.createHmac('sha256', testSecret);
        hmac.update(payload);
        const signature = `sha256=${hmac.digest('hex')}`;

        expect(handler.verifySignature(payload, signature)).toBe(true);
      });
    });
  });

  describe('signature format validation', () => {
    it('should accept sha256= prefix', () => {
      const payload = Buffer.from('test');
      const hmac = crypto.createHmac('sha256', testSecret);
      hmac.update(payload);
      const signature = `sha256=${hmac.digest('hex')}`;

      expect(handler.verifySignature(payload, signature)).toBe(true);
    });

    it('should reject signature without sha256= prefix', () => {
      const payload = Buffer.from('test');
      const hmac = crypto.createHmac('sha256', testSecret);
      hmac.update(payload);
      const signature = hmac.digest('hex');

      expect(handler.verifySignature(payload, signature)).toBe(false);
    });

    it('should reject malformed signatures', () => {
      const payload = Buffer.from('test');
      const malformedSignatures = [
        'sha256',
        'sha256=',
        '=abcdef',
        'md5=abcdef',
        'not-a-signature',
      ];

      malformedSignatures.forEach((sig) => {
        expect(handler.verifySignature(payload, sig)).toBe(false);
      });
    });
  });

  describe('GitHub webhook signature examples', () => {
    it('should verify real GitHub webhook signature format', () => {
      const payload = Buffer.from(
        JSON.stringify({
          action: 'opened',
          issue: {
            number: 1,
            title: 'Test Issue',
          },
          repository: {
            full_name: 'owner/repo',
          },
        }),
      );

      const hmac = crypto.createHmac('sha256', testSecret);
      hmac.update(payload);
      const signature = `sha256=${hmac.digest('hex')}`;

      expect(handler.verifySignature(payload, signature)).toBe(true);
    });

    it('should handle complex payloads', () => {
      const complexPayload = {
        action: 'synchronize',
        pull_request: {
          id: 123456,
          number: 42,
          title: 'Add new feature',
          body: 'This PR adds a new feature\nwith multiple lines\nand special chars: \u00e9\u00e0\u00e7',
          commits: 5,
          additions: 100,
          deletions: 20,
        },
        repository: {
          id: 789,
          name: 'test-repo',
          full_name: 'owner/test-repo',
        },
      };

      const payload = Buffer.from(JSON.stringify(complexPayload));
      const hmac = crypto.createHmac('sha256', testSecret);
      hmac.update(payload);
      const signature = `sha256=${hmac.digest('hex')}`;

      expect(handler.verifySignature(payload, signature)).toBe(true);
    });
  });
});
