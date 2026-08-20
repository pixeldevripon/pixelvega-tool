import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DeltaPill } from './delta-pill';

const tone = (value: string, label: string, name: string) => ({
    value,
    label,
    tone: name,
});

describe('DeltaPill', () => {
    it('renders nothing when there is no comparable previous window', () => {
        // Null is not zero. A change from nothing has no percentage, so the pill
        // must be absent rather than showing "0%".
        const { container } = render(
            <DeltaPill
                changeLabel={null}
                changeRate={null}
                tone={tone('default', 'Steady', 'default')}
            />,
        );

        expect(container).toBeEmptyDOMElement();
    });

    it('renders the label the server sent, never one of its own', () => {
        render(
            <DeltaPill
                changeLabel='+27%'
                changeRate={0.2727}
                tone={tone('success', 'Improving', 'success')}
            />,
        );

        expect(screen.getByText('+27%')).toBeInTheDocument();
    });

    it('carries the tone label as text, so colour is not the only cue', () => {
        // WCAG 1.4.1: a red/green deficit reader must still be able to tell
        // "getting worse" from "improving".
        render(
            <DeltaPill
                changeLabel='+12%'
                changeRate={0.12}
                tone={tone('danger', 'Getting worse', 'danger')}
            />,
        );

        expect(screen.getByText('Getting worse')).toBeInTheDocument();
    });

    it('paints the surface from the tone, not from the sign', () => {
        // A FALL in overdue projects is a success. Deriving the colour from the
        // sign here would paint it red, which is the whole reason `tone` exists.
        render(
            <DeltaPill
                changeLabel='-40%'
                changeRate={-0.4}
                tone={tone('success', 'Improving', 'success')}
            />,
        );

        expect(screen.getByText('-40%').className).toContain('success');
    });

    it('points the arrow down on a fall even when the tone is success', () => {
        // The arrow answers "which way did the number move" and the tone answers
        // "is that good". Tying one to the other draws an up arrow on a fall.
        const { container } = render(
            <DeltaPill
                changeLabel='-40%'
                changeRate={-0.4}
                tone={tone('success', 'Improving', 'success')}
            />,
        );
        const fallingArrow = container.querySelector('svg')?.outerHTML;

        const rising = render(
            <DeltaPill
                changeLabel='+40%'
                changeRate={0.4}
                tone={tone('success', 'Improving', 'success')}
            />,
        );

        expect(fallingArrow).not.toEqual(
            rising.container.querySelector('svg')?.outerHTML,
        );
    });
});
