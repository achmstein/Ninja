/// What an [ApiClient] needs from sign-in: the access token to send, and a
/// refresh when the server says it has expired (one refresh shared by every
/// caller). The staff sign-in (AuthService) and the customer app's own both
/// provide it.
abstract interface class TokenSource {
  Future<String?> getAccessToken();

  /// True when a fresh token is in hand
  Future<bool> refreshToken();
}
