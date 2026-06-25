import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {GmailActionRenderer} from '../ActionRenderer';
import {makeToolUse, makeToolResult} from './helpers';

const P = 'mcp__claude_ai_Gmail__';

describe('GmailActionRenderer', () => {
    it('describes label_thread with the label count', () => {
        render(
            <GmailActionRenderer
                toolUse={makeToolUse({threadId: 't1', labelIds: ['A', 'B']}, `${P}label_thread`)}
            />
        );
        expect(screen.getByText(/Add 2 label\(s\) to thread/)).toBeInTheDocument();
    });

    it('describes unlabel_thread with the label count', () => {
        render(
            <GmailActionRenderer
                toolUse={makeToolUse({threadId: 't1', labelIds: ['A']}, `${P}unlabel_thread`)}
            />
        );
        expect(screen.getByText(/Remove 1 label\(s\) from thread/)).toBeInTheDocument();
    });

    it('describes label_message with the label count', () => {
        render(
            <GmailActionRenderer
                toolUse={makeToolUse({messageId: 'm1', labelIds: ['A', 'B', 'C']}, `${P}label_message`)}
            />
        );
        expect(screen.getByText(/Add 3 label\(s\) to message/)).toBeInTheDocument();
    });

    it('describes unlabel_message with the label count', () => {
        render(
            <GmailActionRenderer
                toolUse={makeToolUse({messageId: 'm1', labelIds: ['A']}, `${P}unlabel_message`)}
            />
        );
        expect(screen.getByText(/Remove 1 label\(s\) from message/)).toBeInTheDocument();
    });

    it('describes create_label with the label name', () => {
        render(
            <GmailActionRenderer toolUse={makeToolUse({name: 'Receipts'}, `${P}create_label`)} />
        );
        expect(screen.getByText(/Create label: Receipts/)).toBeInTheDocument();
    });

    it('describes update_label with the label name', () => {
        render(
            <GmailActionRenderer
                toolUse={makeToolUse({labelId: 'Label_1', name: 'Renamed'}, `${P}update_label`)}
            />
        );
        expect(screen.getByText(/Update label: Renamed/)).toBeInTheDocument();
    });

    it('describes delete_label', () => {
        render(
            <GmailActionRenderer toolUse={makeToolUse({labelId: 'Label_1'}, `${P}delete_label`)} />
        );
        expect(screen.getByText(/Delete label/)).toBeInTheDocument();
    });

    it('renders the IN body with the input', () => {
        render(
            <GmailActionRenderer
                toolUse={makeToolUse({threadId: 't1', labelIds: ['A']}, `${P}label_thread`)}
            />
        );
        expect(screen.getByText('IN')).toBeInTheDocument();
        expect(screen.getByText(/threadId/)).toBeInTheDocument();
    });

    it('renders OUT when a result is present', () => {
        render(
            <GmailActionRenderer
                toolUse={makeToolUse({threadId: 't1', labelIds: ['A']}, `${P}label_thread`)}
                toolResult={makeToolResult('ok')}
            />
        );
        expect(screen.getByText('OUT')).toBeInTheDocument();
    });

    it('does not throw when input is missing', () => {
        expect(() =>
            render(<GmailActionRenderer toolUse={makeToolUse({}, `${P}delete_label`)} />)
        ).not.toThrow();
    });
});
