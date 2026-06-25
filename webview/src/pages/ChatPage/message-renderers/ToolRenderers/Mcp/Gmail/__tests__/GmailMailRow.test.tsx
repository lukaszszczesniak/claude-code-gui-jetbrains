import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {GmailMailRow} from '../_shared';

describe('GmailMailRow', () => {
    it('renders sender, subject, and snippet on a single row', () => {
        render(
            <GmailMailRow
                sender="no-reply@docker.com"
                subject="[Docker Navigator]: latest"
                snippet="Gordon is GA..."
                date="2026-06-08T16:01:01Z"
            />
        );
        expect(screen.getByText('no-reply@docker.com')).toBeInTheDocument();
        expect(screen.getByText('[Docker Navigator]: latest')).toBeInTheDocument();
        // snippet is shown joined with a leading separator: " - Gordon is GA..."
        expect(screen.getByText(/Gordon is GA/)).toBeInTheDocument();
    });

    it('falls back to a placeholder when sender is missing', () => {
        render(<GmailMailRow subject="No sender mail" />);
        expect(screen.getByText('(unknown sender)')).toBeInTheDocument();
    });

    it('bolds the sender and subject when unread', () => {
        render(<GmailMailRow sender="a@b.com" subject="Important" unread />);
        expect(screen.getByText('a@b.com')).toHaveClass('font-semibold');
        expect(screen.getByText('Important')).toHaveClass('font-semibold');
    });

    it('shows the unread dot only when unread', () => {
        const {container, rerender} = render(<GmailMailRow sender="a@b.com" unread />);
        expect(container.querySelector('.bg-text-tertiary')).toBeInTheDocument();
        rerender(<GmailMailRow sender="a@b.com" />);
        expect(container.querySelector('.bg-text-tertiary')).not.toBeInTheDocument();
    });

    it('renders a separator between subject and snippet', () => {
        render(<GmailMailRow sender="a@b.com" subject="Subj" snippet="Snip" />);
        // The separator is rendered inline with the snippet: " - Snip"
        expect(screen.getByText(/-\s*Snip/)).toBeInTheDocument();
    });
});
