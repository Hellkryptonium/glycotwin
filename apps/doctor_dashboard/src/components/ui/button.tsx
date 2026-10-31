import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import styles from './button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'quiet' | 'danger';
  icon?: React.ReactNode;
}

export function Button({ children, variant = 'primary', icon, className = '', ...props }: PropsWithChildren<ButtonProps>) {
  return <button className={`${styles.button} ${styles[variant]} ${className}`} {...props}>{icon}{children}</button>;
}