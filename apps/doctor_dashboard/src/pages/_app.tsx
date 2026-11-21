import type { AppProps } from 'next/app';
import Head from 'next/head';
import { QueryProvider } from '../providers/query.provider';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return <>
    <Head><link rel="icon" type="image/svg+xml" href="/favicon.svg" /></Head>
    <QueryProvider><Component {...pageProps} /></QueryProvider>
  </>;
}
