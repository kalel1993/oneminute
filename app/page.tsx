import Link from 'next/link';
import {Header} from '@/components/Header';
import {PublicData} from '@/components/PublicData';

export default function Home(){
  return <main>
    <Header/>
    <section className="hero">
      <p className="kicker">01 GAME · 60 SECONDS · NO SIGNUP</p>
      <h1>HOW FAST<br/>ARE <i>YOU?</i></h1>
      <p className="lede">You have 60 seconds. One button. No excuses.</p>
      <Link className="megaButton" href="/play">PLAY <span>→</span></Link>
      <p className="fine">Touch or mouse. Anonymous. Your reflexes do the talking.</p>
    </section>
    <PublicData/>
    <footer>
      <span>© 2026 ONEMINUTE.LOL</span>
      <div className="legalLinks">
        <Link href="/leaderboard">Leaderboard</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/refunds">Credits & refunds</Link>
      </div>
    </footer>
  </main>;
}
