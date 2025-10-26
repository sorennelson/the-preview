import NextAuth from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";

async function refreshAccessToken(token: any) {
  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(
            process.env.AUTH_SPOTIFY_ID + ":" + process.env.AUTH_SPOTIFY_SECRET
          ).toString("base64"),
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });

    const refreshedTokens = await response.json();

    if (!response.ok) throw refreshedTokens;

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    console.error("Error refreshing access token", error);
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

const handler = NextAuth({
  providers: [
    SpotifyProvider({
      clientId: process.env.AUTH_SPOTIFY_ID!,
      clientSecret: process.env.AUTH_SPOTIFY_SECRET!,
      authorization:
        "https://accounts.spotify.com/authorize?scope=user-read-email,user-read-private,user-read-playback-state,user-modify-playback-state,streaming",
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        // Ensure account.expires_in is number, fallback sensibly if not
        const expiresIn = typeof account.expires_in === "number" ? account.expires_in : 0;
        token.accessTokenExpires = Date.now() + expiresIn * 1000;
      }
      if (typeof token.accessTokenExpires === "number" && Date.now() < token.accessTokenExpires) return token;
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = typeof token.accessToken === "string" ? token.accessToken : undefined;
      session.error = typeof token.error === "string" ? token.error : undefined;
      
      // Add user ID from token
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      
      return session;
    },
  },
});

export { handler as GET, handler as POST };

