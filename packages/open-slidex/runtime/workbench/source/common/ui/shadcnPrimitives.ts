// Feature modules use this leaf adapter instead of importing the editor-ui
// package barrel, which also exports feature-level editor components.
export { Button } from "@/packages/editor-ui/src/components/ui/button";
export { Field } from "@/packages/editor-ui/src/components/ui/field";
export { Input } from "@/packages/editor-ui/src/components/ui/input";
export { Label } from "@/packages/editor-ui/src/components/ui/label";
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger
} from "@/packages/editor-ui/src/components/ui/dialog";
export {
  NativeSelect,
  NativeSelectOption
} from "@/packages/editor-ui/src/components/ui/native-select";
export {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/packages/editor-ui/src/components/ui/select";
export {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/packages/editor-ui/src/components/ui/popover";
export { Separator } from "@/packages/editor-ui/src/components/ui/separator";
export { Slider } from "@/packages/editor-ui/src/components/ui/slider";
export { Switch } from "@/packages/editor-ui/src/components/ui/switch";
export {
  ToggleGroup,
  ToggleGroupItem
} from "@/packages/editor-ui/src/components/ui/toggle-group";
export { Toggle } from "@/packages/editor-ui/src/components/ui/toggle";
export {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/packages/editor-ui/src/components/ui/tooltip";
