import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {ResultCaption} from '../index';

describe('ResultCaption', () => {
    it('renders its children', () => {
        render(<ResultCaption>Modified</ResultCaption>);
        expect(screen.getByText('Modified')).toBeInTheDocument();
    });

    it('applies the default caption styling classes', () => {
        render(<ResultCaption>7 found</ResultCaption>);
        const el = screen.getByText('7 found');
        expect(el).toHaveClass('text-text-primary/50');
        expect(el).toHaveClass('text-[0.8461rem]');
        expect(el).toHaveClass('mb-1');
    });

    it('merges an extra className with the defaults', () => {
        render(<ResultCaption className="mt-4">caption</ResultCaption>);
        const el = screen.getByText('caption');
        expect(el).toHaveClass('mt-4');
        expect(el).toHaveClass('mb-1');
    });
});
