import * as CollapsiblePrimitive from "@rn-primitives/collapsible";

function Collapsible(
  props: CollapsiblePrimitive.RootProps &
    React.RefAttributes<CollapsiblePrimitive.RootRef>,
) {
  return <CollapsiblePrimitive.Root {...props} />;
}

function CollapsibleTrigger(
  props: CollapsiblePrimitive.TriggerProps &
    React.RefAttributes<CollapsiblePrimitive.TriggerRef>,
) {
  return <CollapsiblePrimitive.Trigger {...props} />;
}

function CollapsibleContent(
  props: CollapsiblePrimitive.ContentProps &
    React.RefAttributes<CollapsiblePrimitive.ContentRef>,
) {
  return <CollapsiblePrimitive.Content {...props} />;
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
