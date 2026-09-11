import type { ComponentProps } from 'react';
import { Tabs as BaseTabs } from '@base-ui/react/tabs';

export function Tabs(props: ComponentProps<typeof BaseTabs.Root>) {
  return <BaseTabs.Root data-slot="tabs" {...props}/>;
}

export function TabsList(props: ComponentProps<typeof BaseTabs.List>) {
  return <BaseTabs.List data-slot="tabs-list" activateOnFocus {...props}/>;
}

export function TabsTrigger(props: ComponentProps<typeof BaseTabs.Tab>) {
  return <BaseTabs.Tab data-slot="tabs-trigger" {...props}/>;
}
