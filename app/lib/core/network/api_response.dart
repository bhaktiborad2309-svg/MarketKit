import 'package:dio/dio.dart';

/// Unwrapping helpers for the API's response envelope.
///
/// Every endpoint answers with `{"success": true, "data": ...}` (see
/// pkg/response on the Go side), so every service was repeating the same three
/// steps: reach into `data`, cast the list, and map each entry through a
/// model's `fromJson`. Sixteen copies of the same four lines.
///
///     // before
///     final list = res.data['data'] as List<dynamic>;
///     return list.map((e) => PhotoModel.fromJson(e as Map<String, dynamic>)).toList();
///
///     // after
///     return parseDataList(res, PhotoModel.fromJson);

/// Reads the `data` array out of a response and builds a model from each entry.
///
/// Returns an empty list when `data` is absent or null, which is what the API
/// sends for an empty page — callers should render "nothing here", not crash.
List<T> parseDataList<T>(
  Response<dynamic> res,
  T Function(Map<String, dynamic>) fromJson,
) {
  final list = res.data['data'] as List<dynamic>?;
  if (list == null) return <T>[];

  return list.map((e) => fromJson(e as Map<String, dynamic>)).toList();
}

/// Reads the single `data` object out of a response.
///
/// Throws if `data` is missing, because an endpoint documented to return one
/// object and returning nothing is a bug worth surfacing rather than papering
/// over with a fake empty model.
T parseDataObject<T>(
  Response<dynamic> res,
  T Function(Map<String, dynamic>) fromJson,
) {
  final data = res.data['data'];
  if (data == null) {
    throw StateError('expected a "data" object in the response, got none');
  }

  return fromJson(data as Map<String, dynamic>);
}
