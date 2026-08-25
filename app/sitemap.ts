import type {MetadataRoute} from 'next';
export default function sitemap():MetadataRoute.Sitemap{
  return['','/leaderboard','/privacy','/terms','/refunds'].map(path=>({
    url:`https://oneminute.lol${path}`,
    changeFrequency:path==='/leaderboard'?'daily':'monthly',
    priority:path===''?1:path==='/leaderboard'?0.9:0.4,
  }));
}
