import {SignIn} from '@clerk/nextjs';
export const metadata={title:'Log in'};
export default function Page(){if(!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)return <main className="authPage"><p>Login is being connected. Please try again shortly.</p></main>;return <main className="authPage"><SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" forceRedirectUrl="/account"/></main>}
