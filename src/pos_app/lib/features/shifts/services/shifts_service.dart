import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/money.dart';
import '../../../core/network/api_client.dart';
import '../../tickets/services/tickets_service.dart' show asSalesException;
import '../models/shift.dart';

/// `GET /api/shifts/{id}` came back 404
class ShiftNotFound implements Exception {
  const ShiftNotFound();
}

abstract class ShiftsRepository {
  /// Open the branch's drawer shift with the counted float; returns its id
  Future<int> openShift(double openingFloat, {String? requestId});

  /// The branch's open shift, or null — the server's normal "no shift
  /// open" answer is a 404, not an error
  Future<ShiftView?> getCurrentShift();

  Future<ShiftView> getShift(int id);

  /// Closed shifts, newest first; a page shorter than `pageSize` is the last
  Future<List<ShiftView>> getClosedShifts({int pageIndex = 0, int pageSize = 20});

  Future<void> addMovement(int id, CashMovementRequest request, {String? requestId});

  /// Count the drawer and freeze the Z, which is returned
  Future<ShiftView> closeShift(int id, double closingCount, {String? requestId});
}

class ApiShiftsRepository implements ShiftsRepository {
  final ApiClient _apiClient;

  ApiShiftsRepository(this._apiClient);

  @override
  Future<int> openShift(double openingFloat, {String? requestId}) async {
    try {
      final response = await _apiClient.post<Map<String, dynamic>>(
        'shifts/open',
        data: {'openingFloat': openingFloat},
        requestId: requestId,
      );
      return toInt(response.data?['shiftId']);
    } on DioException catch (e) {
      throw asSalesException(e);
    }
  }

  @override
  Future<ShiftView?> getCurrentShift() async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>('shifts/current');
      return ShiftView.fromJson(response.data!);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      rethrow;
    }
  }

  @override
  Future<ShiftView> getShift(int id) async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>('shifts/$id');
      return ShiftView.fromJson(response.data!);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) throw const ShiftNotFound();
      rethrow;
    }
  }

  @override
  Future<List<ShiftView>> getClosedShifts({int pageIndex = 0, int pageSize = 20}) async {
    final response = await _apiClient.get<List<dynamic>>(
      'shifts',
      queryParameters: {'pageIndex': pageIndex, 'pageSize': pageSize},
    );
    return (response.data ?? []).map((e) => ShiftView.fromJson(e as Map<String, dynamic>)).toList();
  }

  @override
  Future<void> addMovement(int id, CashMovementRequest request, {String? requestId}) async {
    try {
      await _apiClient.post('shifts/$id/movements', data: request.toJson(), requestId: requestId);
    } on DioException catch (e) {
      throw asSalesException(e);
    }
  }

  @override
  Future<ShiftView> closeShift(int id, double closingCount, {String? requestId}) async {
    try {
      final response = await _apiClient.post<Map<String, dynamic>>(
        'shifts/$id/close',
        data: {'closingCount': closingCount},
        requestId: requestId,
      );
      return ShiftView.fromJson(response.data!);
    } on DioException catch (e) {
      throw asSalesException(e);
    }
  }
}

final shiftsRepositoryProvider = Provider<ShiftsRepository>((ref) {
  return ApiShiftsRepository(ref.read(salesApiProvider));
});
