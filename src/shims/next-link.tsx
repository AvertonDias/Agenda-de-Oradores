import React from 'react';
import { Link as ReactRouterLink } from 'react-router-dom';

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  prefetch?: boolean;
}

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ href, prefetch, ...props }, ref) => {
    return <ReactRouterLink ref={ref} to={href} {...props} />;
  }
);

Link.displayName = 'Link';

export default Link;
