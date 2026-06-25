import {describe, it, expect} from 'vitest';
import {formatMcpToolName} from '../_common';

describe('formatMcpToolName', () => {
    it('converts mcp__claude_ai_Gmail__search_threads to Claude AI Gmail [search_threads]', () => {
        expect(formatMcpToolName('mcp__claude_ai_Gmail__search_threads')).toBe(
            'Claude AI Gmail [search_threads]'
        );
    });

    it('converts mcp__claude_ai_Gmail__create_draft to Claude AI Gmail [create_draft]', () => {
        expect(formatMcpToolName('mcp__claude_ai_Gmail__create_draft')).toBe(
            'Claude AI Gmail [create_draft]'
        );
    });

    it('converts mcp__filesystem__read_file to Filesystem [read_file]', () => {
        expect(formatMcpToolName('mcp__filesystem__read_file')).toBe('Filesystem [read_file]');
    });

    it('returns a plain tool name (no mcp__ prefix) unchanged', () => {
        expect(formatMcpToolName('Bash')).toBe('Bash');
    });

    it('returns an empty string unchanged', () => {
        expect(formatMcpToolName('')).toBe('');
    });

    it('uppercases short all-lowercase tokens (ai → AI, my → MY)', () => {
        // Both 'my' (2 chars) and 'ai' (2 chars) are fully uppercased per the rule.
        // 'tool' (4 chars) is title-cased.
        expect(formatMcpToolName('mcp__my_ai_tool__do_something')).toBe(
            'MY AI Tool [do_something]'
        );
    });

    it('preserves original casing for tokens longer than 2 chars (Gmail stays Gmail)', () => {
        expect(formatMcpToolName('mcp__claude_ai_Gmail__get_thread')).toBe(
            'Claude AI Gmail [get_thread]'
        );
    });

    it('falls back to original string when fewer than 3 segments', () => {
        expect(formatMcpToolName('mcp__only_one_segment')).toBe('mcp__only_one_segment');
    });

    it('falls back to original string when prefix is not mcp', () => {
        expect(formatMcpToolName('tool__server__action')).toBe('tool__server__action');
    });
});
