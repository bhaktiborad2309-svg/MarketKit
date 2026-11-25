import '../../../core/network/dio_client.dart';
import '../../../core/network/api_endpoints.dart';
import '../models/photo_model.dart';
import '../../../core/network/api_response.dart';

class PhotosService {
  final _dio = DioClient().dio;

  Future<List<PhotoModel>> fetchPublished() async {
    final res = await _dio.get(ApiEndpoints.photosPublic);
    return parseDataList(res, PhotoModel.fromJson);
  }

  Future<List<PhotoModel>> fetchVideoPhotos(String videoId) async {
    final res = await _dio.get(ApiEndpoints.videoPhotos(videoId));
    return parseDataList(res, PhotoModel.fromJson);
  }

  // photoUrl constructs a URL from a fileKey for backward compatibility.
  // New code should use photo.url directly (set by the API).
  String photoUrl(String fileKey) {
    if (fileKey.startsWith('http')) return fileKey;
    return '${ApiEndpoints.staticBase}/uploads/$fileKey';
  }
}
