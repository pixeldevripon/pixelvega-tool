import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AccountTabs } from './account-tabs';

const tabs = [
    { key: 'general', label: 'General' },
    { key: 'security', label: 'Security' },
];

function renderTabs(active = 'general') {
    const onChange = vi.fn();
    render(<AccountTabs tabs={tabs} active={active} onChange={onChange} />);
    return { onChange };
}

describe('AccountTabs', () => {
    it('is a real tablist, not a row of buttons that looks like one', () => {
        renderTabs();
        expect(
            screen.getByRole('tablist', { name: 'Account sections' }),
        ).toBeInTheDocument();
        expect(screen.getAllByRole('tab')).toHaveLength(2);
    });

    it('marks the active tab selected', () => {
        renderTabs('security');
        expect(screen.getByRole('tab', { name: 'Security' })).toHaveAttribute(
            'aria-selected',
            'true',
        );
        expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute(
            'aria-selected',
            'false',
        );
    });

    it('points each tab at the panel it controls', () => {
        renderTabs();
        expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute(
            'aria-controls',
            'account-panel-general',
        );
    });

    it('keeps only the active tab in the tab order', () => {
        // Tab moves to the panel and arrows move between tabs, which is the
        // pattern a keyboard user expects from a tablist.
        renderTabs();
        expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute(
            'tabindex',
            '0',
        );
        expect(screen.getByRole('tab', { name: 'Security' })).toHaveAttribute(
            'tabindex',
            '-1',
        );
    });

    it('reports the tab that was clicked', async () => {
        const { onChange } = renderTabs();
        await userEvent.click(screen.getByRole('tab', { name: 'Security' }));
        expect(onChange).toHaveBeenCalledWith('security');
    });

    it('moves with the arrow keys', async () => {
        const { onChange } = renderTabs('general');
        screen.getByRole('tab', { name: 'General' }).focus();
        await userEvent.keyboard('{ArrowRight}');
        expect(onChange).toHaveBeenCalledWith('security');
    });

    it('wraps at the ends, as the ARIA tabs pattern specifies', () => {
        const { onChange } = renderTabs('general');
        screen.getByRole('tab', { name: 'General' }).focus();
        return userEvent.keyboard('{ArrowLeft}').then(() => {
            expect(onChange).toHaveBeenCalledWith('security');
        });
    });

    it('renders only the tabs it was given', () => {
        // The reference design has seven. Tabs whose content this product does
        // not have are absent rather than present and dead.
        renderTabs();
        expect(
            screen.queryByRole('tab', { name: 'Billing & Usage' }),
        ).not.toBeInTheDocument();
    });
});
