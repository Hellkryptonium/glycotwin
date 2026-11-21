import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import styles from './home.module.css';

type Props = { version: string | null; unavailable: boolean };
const repository = 'Hellkryptonium/glycotwin';

export const getServerSideProps: GetServerSideProps<Props> = async ({ res }) => {
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
  try {
    const response = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, {
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 404) return { props: { version: null, unavailable: false } };
    if (!response.ok) throw new Error('Release lookup failed');
    const release = await response.json();
    const ready = /^android-beta-[1-9]\d*$/.test(release.tag_name) &&
      ['glycotwin-phone.apk', 'glycotwin-watch.apk'].every(name =>
        release.assets.some((asset: { name: string }) => asset.name === name));
    return { props: { version: ready ? release.tag_name : null, unavailable: false } };
  } catch {
    return { props: { version: null, unavailable: true } };
  }
};

export default function Download({ version, unavailable }: Props) {
  const base = `https://github.com/${repository}/releases/download/${version}`;
  return <main className={styles.page}>
    <Head><title>Download the Android beta | GlycoTwin</title></Head>
    <header className={styles.header}><Link href="/" className={styles.brand}><span>G</span> GlycoTwin</Link><Link href="/auth/login" className={styles.signIn}>Doctor sign in</Link></header>
    <section className={styles.hero}><div className={styles.heroCopy}>
      <h1>Android beta</h1><p>Test GlycoTwin with sample patient data on a phone running Android 8 or newer.</p>
      {version ? <>
        <div className={styles.actions}><a className={styles.primary} href={base + '/glycotwin-phone.apk'}>Download phone APK</a><a className={styles.secondary} href={`https://github.com/${repository}/releases/tag/${version}`}>{version.replace('android-beta-', 'Release ')}</a></div>
        <p>Open the downloaded APK on your phone. If Android asks, allow this browser to install the app, then tap Install.</p>
        <a className={styles.secondary} href={base + '/glycotwin-watch.apk'}>Download companion Wear OS APK</a>
      </> : <p role="status">{unavailable ? 'GitHub downloads could not be checked. Try again shortly.' : 'The first Android beta will be available here once published.'}</p>}
    </div></section>
  </main>;
}
