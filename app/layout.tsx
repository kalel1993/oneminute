import type {Metadata,Viewport} from 'next';
import {ClerkProvider} from '@clerk/nextjs';
import {Analytics} from '@vercel/analytics/next';
import {PresenceTracker} from '@/components/PresenceTracker';
import {clerkConfigured} from '@/lib/server';
import './globals.css';
import './viral.css';

export const metadata:Metadata={
  metadataBase:new URL('https://oneminute.lol'),
  title:{default:'OneMinute.lol — How fast are you?','template':'%s — OneMinute.lol'},
  description:'You have 60 seconds. Hit the button. Set the pace.',
  alternates:{canonical:'/'},
  openGraph:{title:'OneMinute.lol',description:'You have 60 seconds. How fast are you?',url:'/',siteName:'OneMinute.lol',type:'website'},
  twitter:{card:'summary_large_image'},
  icons:{icon:'/icon.svg'},
  manifest:'/manifest.webmanifest'
};
export const viewport:Viewport={themeColor:'#0b0b0a',width:'device-width',initialScale:1,maximumScale:1};
export default function RootLayout({children}:{children:React.ReactNode}){
  const content=<>{children}<PresenceTracker/><Analytics/></>;
  return <html lang="en"><body>{clerkConfigured()?<ClerkProvider>{content}</ClerkProvider>:content}</body></html>;
}
