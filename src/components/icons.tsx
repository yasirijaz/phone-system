export const Logo = (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
  <img src="/logo.png" alt={props.alt || 'Voice by WHUB'} {...props} />
);
  
