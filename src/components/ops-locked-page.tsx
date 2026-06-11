import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/lib/format";

type OpsLockedPageProps<T extends ElementType = "div"> = {
  header?: ReactNode;
  filters?: ReactNode;
  body?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  as?: T;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

export function OpsLockedPage<T extends ElementType = "div">({
  header,
  filters,
  body,
  footer,
  children,
  className,
  as,
  ...rest
}: OpsLockedPageProps<T>) {
  const Component = (as ?? "div") as ElementType;

  return (
    <Component className={cn("ops-locked-page h-full min-h-0 flex flex-col overflow-hidden", className)} {...rest}>
      {header ? <div className="ops-locked-page__header shrink-0">{header}</div> : null}
      {filters ? <div className="ops-locked-page__filters shrink-0">{filters}</div> : null}
      {body ? <div className="ops-locked-page__body min-h-0 flex-1 overflow-hidden">{body}</div> : null}
      {children}
      {footer ? <div className="ops-locked-page__footer shrink-0">{footer}</div> : null}
    </Component>
  );
}