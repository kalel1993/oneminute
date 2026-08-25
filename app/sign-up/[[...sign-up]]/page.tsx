import {SignUp} from '@clerk/nextjs';
export const metadata={title:'Create account'};
export default function Page(){if(!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)return <main className="authPage"><p>Account creation is being connected. Please try again shortly.</p></main>;return <main className="authPage"><SignUp routing="path" path="/sign-up" signInUrl="/sign-in" forceRedirectUrl="/account"/></main>}
