import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AppCache {
  static const _prefix = 'cache_';

  /// True when any network interface is available.
  /// Uses a one-shot check so callers can skip requests when offline.
  static Future<bool> get isOnline async {
    final results = await Connectivity().checkConnectivity();
    return results.any((r) => r != ConnectivityResult.none);
  }

  static Future<void> putList(
      String key, List<Map<String, dynamic>> data) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefix + key, jsonEncode(data));
  }

  static Future<List<Map<String, dynamic>>?> getList(String key) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_prefix + key);
    if (raw == null) return null;
    final list = jsonDecode(raw) as List<dynamic>;
    return list.cast<Map<String, dynamic>>();
  }

  /// getList, with each entry already turned into a model.
  ///
  /// Returns null — not an empty list — when nothing has been cached under this
  /// key, so callers can tell "we have no copy" (show the offline error) apart
  /// from "we cached an empty result" (show the empty state).
  ///
  /// Every offline-capable provider needs exactly this, so it lives here rather
  /// than being spelled out in each `_serveFromCache`.
  static Future<List<T>?> getModels<T>(
    String key,
    T Function(Map<String, dynamic>) fromJson,
  ) async {
    final cached = await getList(key);
    return cached?.map(fromJson).toList();
  }
}
