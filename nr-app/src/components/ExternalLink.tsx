import { Link, LinkProps } from "expo-router";

export function ExternalLink({ href, ...rest }: LinkProps) {
  return <Link target="_blank" {...rest} href={href} />;
}
