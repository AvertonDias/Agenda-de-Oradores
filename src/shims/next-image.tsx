import React from 'react';

interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  priority?: boolean;
  className?: string;
}

export default function Image({ src, alt, width, height, priority, ...props }: ImageProps) {
  return <img src={src} alt={alt} width={width} height={height} {...props} />;
}
