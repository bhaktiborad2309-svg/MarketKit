import '../../../core/network/dio_client.dart';
import '../../../core/network/api_endpoints.dart';
import '../models/plan_model.dart';
import '../../../core/network/api_response.dart';

class PlansService {
  final _dio = DioClient().dio;

  Future<List<PlanModel>> fetchPlans() async {
    final res = await _dio.get(ApiEndpoints.plans);
    return parseDataList(res, PlanModel.fromJson);
  }

  Future<Map<String, dynamic>> createOrder(String planId) async {
    final res = await _dio.post(
      ApiEndpoints.userPaymentOrder,
      data: {'plan_id': planId},
    );
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<void> verifyPayment({
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  }) async {
    await _dio.post(
      ApiEndpoints.userPaymentVerify,
      data: {
        'provider_order_id': razorpayOrderId,
        'provider_payment_id': razorpayPaymentId,
        'provider_signature': razorpaySignature,
      },
    );
  }
}
