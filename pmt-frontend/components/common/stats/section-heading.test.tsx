import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SectionHeading } from './section-heading';

describe('SectionHeading', () => {
    it('renders the title as a heading', () => {
        render(<SectionHeading title='Projects' />);

        expect(
            screen.getByRole('heading', { name: 'Projects' }),
        ).toBeInTheDocument();
    });

    it('renders the count chip when a count is given', () => {
        render(<SectionHeading title='Projects' count={22} />);

        expect(screen.getByText('22')).toBeInTheDocument();
    });

    it('renders a zero count rather than hiding it', () => {
        // Zero is a measured answer here: "Projects 0" is a fact, and a chip
        // that vanished would read as "we did not check".
        render(<SectionHeading title='Projects' count={0} />);

        expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('omits the chip when no count is given', () => {
        const { container } = render(<SectionHeading title='Projects' />);

        expect(container.querySelectorAll('span')).toHaveLength(1);
    });

    it('renders the action on the trailing edge', () => {
        render(
            <SectionHeading
                title='Projects'
                action={<button type='button'>10 more</button>}
            />,
        );

        expect(
            screen.getByRole('button', { name: '10 more' }),
        ).toBeInTheDocument();
    });
});
