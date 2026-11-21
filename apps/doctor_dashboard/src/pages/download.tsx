import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import styles from './home.module.css';

type Props = { phone: string | null; watch: string | null; unavailable: boolean };
const repository = 'Hellkryptonium/glycotwin';

export const getServerSideProps: GetServerSideProps<Props> = async ({ res }) => {
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
  try {
    const versions: Props = { phone: null, watch: null, unavailable: false };
    const timeout = AbortSignal.timeout(5000);
    for (let page = 1; ; page++) {
      const response = await fetch(`https://api.github.com/repos/${repository}/releases?per_page=100&page=${page}`, { signal: timeout });
      if (!response.ok) throw new Error('Release lookup failed');
      const releases = await response.json();
      for (const release of releases) {
        if (release.draft) continue;
        const match = /^android-(?:(phone|watch)-)?beta-([1-9]\d*)$/.exec(release.tag_name);
        if (!match) continue;
        for (const device of ['phone', 'watch'] as const) {
          if (versions[device] || (match[1] && match[1] !== device)) continue;
          if (release.assets.some((asset: { name: string }) => asset.name === `glycotwin-${device}.apk`)) {
            versions[device] = release.tag_name;
          }
        }
      }
      if ((versions.phone && versions.watch) || releases.length < 100) break;
    }
    return { props: versions };
  } catch {
    return { props: { phone: null, watch: null, unavailable: true } };
  }
};

export default function Download({ phone, watch, unavailable }: Props) {
  const base = `https://github.com/${repository}/releases/download`;
  return <main className={styles.page}>
    <Head><title>Download the Android beta | GlycoTwin</title></Head>
    <header className={styles.header}><Link href="/" className={styles.brand}><span>G</span> GlycoTwin</Link><Link href="/auth/login" className={styles.signIn}>Doctor sign in</Link></header>
    <section className={styles.hero}><div className={styles.heroCopy}>
      <h1>Android beta</h1><p>Test GlycoTwin with sample patient data on a phone running Android 8 or newer.</p>
      {phone ? <>
        <div className={styles.actions}><a className={styles.primary} href={`${base}/${phone}/glycotwin-phone.apk`}>Download phone APK</a><a className={styles.secondary} href={`https://github.com/${repository}/releases/tag/${phone}`}>{'Release ' + phone.split('-').pop()}</a></div>
        <p>Open the downloaded APK on your phone. If Android asks, allow this browser to install the app, then tap Install.</p>

      </> : <p role="status">{unavailable ? 'GitHub downloads could not be checked. Try again shortly.' : 'The first phone beta will be available here once published.'}</p>}
      {watch && <a className={styles.secondary} href={`${base}/${watch}/glycotwin-watch.apk`}>Download companion Wear OS APK</a>}
    </div></section>
  </main>;
}
