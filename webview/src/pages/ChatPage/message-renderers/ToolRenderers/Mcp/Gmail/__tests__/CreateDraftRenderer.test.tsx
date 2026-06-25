import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {CreateDraftRenderer} from '../CreateDraftRenderer';
import {makeToolUse, makeToolResult} from './helpers';

const TOOL = 'mcp__claude_ai_Gmail__create_draft';

describe('CreateDraftRenderer', () => {
    const input = {
        to: ['alice@example.com', 'bob@example.com'],
        cc: ['carol@example.com'],
        subject: 'Meeting notes',
        body: 'Here are the notes from today.',
    };

    it('renders the formatted tool name in the header', () => {
        render(<CreateDraftRenderer toolUse={makeToolUse(input, TOOL)} />);
        expect(screen.getByText('Claude AI Gmail [create_draft]')).toBeInTheDocument();
    });

    it('renders recipients from to', () => {
        render(<CreateDraftRenderer toolUse={makeToolUse(input, TOOL)} />);
        expect(screen.getByText(/alice@example.com/)).toBeInTheDocument();
        expect(screen.getByText(/bob@example.com/)).toBeInTheDocument();
    });

    it('renders the subject', () => {
        render(<CreateDraftRenderer toolUse={makeToolUse(input, TOOL)} />);
        expect(screen.getByText('Meeting notes')).toBeInTheDocument();
    });

    it('renders the body', () => {
        render(<CreateDraftRenderer toolUse={makeToolUse(input, TOOL)} />);
        expect(screen.getByText('Here are the notes from today.')).toBeInTheDocument();
    });

    it('does not throw when input is missing', () => {
        expect(() => render(<CreateDraftRenderer toolUse={makeToolUse({}, TOOL)} />)).not.toThrow();
    });

    it('shows OUT when a tool result is present', () => {
        render(
            <CreateDraftRenderer
                toolUse={makeToolUse(input, TOOL)}
                toolResult={makeToolResult('draft_abc123')}
            />
        );
        expect(screen.getByText('OUT')).toBeInTheDocument();
        expect(screen.getByText(/draft_abc123/)).toBeInTheDocument();
    });
});
