import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class ApiService {
  static final ApiService instance = ApiService._internal();
  ApiService._internal();

  String? token;
  String? userId;

  String get baseUrl {
    if (kIsWeb) return '/api';
    return 'https://elo.hzsys.tech/api';
  }

  Map<String, String> get headers => {
    'Content-Type': 'application/json',
    if (token != null) 'Authorization': 'Bearer $token',
  };

  Future<Map<String, dynamic>> register({
    required String displayName,
    required String email,
    required String password,
    required String birthDate,
    required bool acceptTerms,
  }) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/auth/register'),
        headers: headers,
        body: jsonEncode({
          'display_name': displayName,
          'email': email,
          'password': password,
          'birth_date': birthDate,
          'accept_terms': acceptTerms,
        }),
      );
      final data = jsonDecode(res.body);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        token = data['access_token'];
        userId = data['id'];
        return {'ok': true, 'data': data};
      }
      return {'ok': false, 'error': data['message'] ?? 'Erro no cadastro'};
    } catch (e) {
      return {'ok': false, 'error': 'Falha na conexão com o servidor: $e'};
    }
  }

  Future<Map<String, dynamic>> login(String email, String password) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/auth/login'),
        headers: headers,
        body: jsonEncode({'email': email, 'password': password}),
      );
      final data = jsonDecode(res.body);
      if (res.statusCode == 200) {
        token = data['access_token'];
        userId = data['id'];
        return {'ok': true, 'data': data};
      }
      return {'ok': false, 'error': data['message'] ?? 'Credenciais inválidas'};
    } catch (e) {
      return {'ok': false, 'error': 'Falha na conexão: $e'};
    }
  }

  Future<Map<String, dynamic>> getMe() async {
    try {
      final res = await http.get(Uri.parse('$baseUrl/me'), headers: headers);
      if (res.statusCode == 200) {
        return {'ok': true, 'data': jsonDecode(res.body)};
      }
      return {'ok': false, 'error': 'Não autorizado'};
    } catch (e) {
      return {'ok': false, 'error': e.toString()};
    }
  }

  Future<Map<String, dynamic>> updateProfile({
    String? displayName,
    String? identity,
    String? pronouns,
    String? pronounsCustom,
    String? bio,
    List<String>? interests,
    bool? visible,
    bool? showDistance,
    String? cityCode,
  }) async {
    try {
      final payload = <String, dynamic>{};
      if (displayName != null) payload['display_name'] = displayName;
      if (identity != null) payload['identity'] = identity;
      if (pronouns != null) payload['pronouns'] = pronouns;
      if (pronounsCustom != null) payload['pronouns_custom'] = pronounsCustom;
      if (bio != null) payload['bio'] = bio;
      if (interests != null) payload['interests'] = interests;
      if (visible != null) payload['visible'] = visible;
      if (showDistance != null) payload['show_distance'] = showDistance;
      if (cityCode != null) payload['city_code'] = cityCode;

      final res = await http.patch(
        Uri.parse('$baseUrl/me/profile'),
        headers: headers,
        body: jsonEncode(payload),
      );
      final data = jsonDecode(res.body);
      if (res.statusCode == 200) return {'ok': true, 'data': data};
      return {'ok': false, 'error': data['message'] ?? 'Erro ao atualizar perfil'};
    } catch (e) {
      return {'ok': false, 'error': e.toString()};
    }
  }

  Future<Map<String, dynamic>> updatePreferences({
    required List<String> seeking,
    required int maxDistanceKm,
    required int ageMin,
    required int ageMax,
    List<String>? interests,
  }) async {
    try {
      final res = await http.put(
        Uri.parse('$baseUrl/me/preferences'),
        headers: headers,
        body: jsonEncode({
          'seeking': seeking,
          'max_distance_km': maxDistanceKm,
          'age_min': ageMin,
          'age_max': ageMax,
          'interests': interests ?? [],
        }),
      );
      final data = jsonDecode(res.body);
      if (res.statusCode == 200) return {'ok': true, 'data': data};
      return {'ok': false, 'error': data['message'] ?? 'Erro ao atualizar preferências'};
    } catch (e) {
      return {'ok': false, 'error': e.toString()};
    }
  }

  Future<Map<String, dynamic>> getDiscovery() async {
    try {
      final res = await http.get(Uri.parse('$baseUrl/discover'), headers: headers);
      if (res.statusCode == 200) {
        return {'ok': true, 'data': jsonDecode(res.body)};
      }
      return {'ok': false, 'error': 'Erro ao carregar perfis'};
    } catch (e) {
      return {'ok': false, 'error': e.toString()};
    }
  }

  Future<Map<String, dynamic>> swipe(String targetUserId, bool isLike) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/swipes'),
        headers: headers,
        body: jsonEncode({
          'user_id': targetUserId,
          'kind': isLike ? 'like' : 'pass',
        }),
      );
      final data = jsonDecode(res.body);
      if (res.statusCode == 200) {
        return {'ok': true, 'matched': data['matched'] == true, 'data': data};
      }
      return {'ok': false, 'error': data['message'] ?? 'Erro no swipe'};
    } catch (e) {
      return {'ok': false, 'error': e.toString()};
    }
  }

  Future<Map<String, dynamic>> getMatches() async {
    try {
      final res = await http.get(Uri.parse('$baseUrl/matches'), headers: headers);
      if (res.statusCode == 200) {
        return {'ok': true, 'data': jsonDecode(res.body)};
      }
      return {'ok': false, 'error': 'Erro ao carregar matches'};
    } catch (e) {
      return {'ok': false, 'error': e.toString()};
    }
  }

  Future<Map<String, dynamic>> getMessages(String matchId) async {
    try {
      final res = await http.get(Uri.parse('$baseUrl/matches/$matchId/messages'), headers: headers);
      if (res.statusCode == 200) {
        return {'ok': true, 'data': jsonDecode(res.body)};
      }
      return {'ok': false, 'error': 'Erro ao carregar mensagens'};
    } catch (e) {
      return {'ok': false, 'error': e.toString()};
    }
  }

  Future<Map<String, dynamic>> sendMessage(String matchId, String body) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/matches/$matchId/messages'),
        headers: headers,
        body: jsonEncode({'body': body}),
      );
      final data = jsonDecode(res.body);
      if (res.statusCode == 201) return {'ok': true, 'data': data};
      return {'ok': false, 'error': data['message'] ?? 'Erro ao enviar'};
    } catch (e) {
      return {'ok': false, 'error': e.toString()};
    }
  }

  Future<Map<String, dynamic>> blockUser(String targetUserId) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/blocks'),
        headers: headers,
        body: jsonEncode({'user_id': targetUserId}),
      );
      return {'ok': res.statusCode == 200};
    } catch (e) {
      return {'ok': false, 'error': e.toString()};
    }
  }

  Future<Map<String, dynamic>> reportUser({
    required String targetUserId,
    required String reason,
    String? details,
    bool alsoBlock = true,
  }) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/reports'),
        headers: headers,
        body: jsonEncode({
          'user_id': targetUserId,
          'reason': reason,
          'details': details ?? '',
          'also_block': alsoBlock,
        }),
      );
      return {'ok': res.statusCode == 201};
    } catch (e) {
      return {'ok': false, 'error': e.toString()};
    }
  }

  Future<Map<String, dynamic>> requestVerification() async {
    try {
      final res = await http.post(Uri.parse('$baseUrl/me/verification'), headers: headers);
      final data = jsonDecode(res.body);
      return {'ok': res.statusCode == 200, 'data': data};
    } catch (e) {
      return {'ok': false, 'error': e.toString()};
    }
  }
}
