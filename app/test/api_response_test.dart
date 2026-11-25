import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:marketkit/core/network/api_response.dart';

/// A stand-in for a real model, so these tests exercise the unwrapping rather
/// than any particular feature's parsing.
class _Item {
  const _Item(this.id);
  final String id;

  static _Item fromJson(Map<String, dynamic> json) => _Item(json['id'] as String);
}

Response<dynamic> responseWith(dynamic body) =>
    Response<dynamic>(requestOptions: RequestOptions(path: '/test'), data: body);

void main() {
  group('parseDataList', () {
    test('builds one model per entry', () {
      final res = responseWith({
        'success': true,
        'data': [
          {'id': 'a'},
          {'id': 'b'},
        ],
      });

      final items = parseDataList(res, _Item.fromJson);

      expect(items.map((i) => i.id), ['a', 'b']);
    });

    test('an empty page is an empty list, not an error', () {
      final res = responseWith({'success': true, 'data': <dynamic>[]});

      expect(parseDataList(res, _Item.fromJson), isEmpty);
    });

    // The API sends data: null for some empty responses. Callers should render
    // an empty state rather than crash, so this must not throw.
    test('a null data field is an empty list', () {
      final res = responseWith({'success': true, 'data': null});

      expect(parseDataList(res, _Item.fromJson), isEmpty);
    });
  });

  group('parseDataObject', () {
    test('builds the single model', () {
      final res = responseWith({
        'success': true,
        'data': {'id': 'only'},
      });

      expect(parseDataObject(res, _Item.fromJson).id, 'only');
    });

    // Unlike a list, a missing object means the endpoint broke its own
    // contract — better to fail loudly than invent an empty model.
    test('throws when data is missing', () {
      final res = responseWith({'success': true});

      expect(() => parseDataObject(res, _Item.fromJson), throwsStateError);
    });
  });
}
