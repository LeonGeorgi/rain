import type { ComponentProps } from 'react';
import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox';
import { Check } from 'lucide-react';

export function Checkbox(props: ComponentProps<typeof BaseCheckbox.Root>) {
  return (
    <BaseCheckbox.Root data-slot="checkbox" {...props}>
      <BaseCheckbox.Indicator data-slot="checkbox-indicator"><Check size={12}/></BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );
}
