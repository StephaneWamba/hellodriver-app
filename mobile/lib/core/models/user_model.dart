class UserModel {
  const UserModel({
    required this.id,
    required this.phone,
    this.name,
    this.email,
    this.role,
    this.avatarUrl,
    this.isVerified = false,
    this.referralCode,
    this.ratingAvg,
    this.ratingCount,
  });

  final String id;
  final String phone;
  final String? name;
  final String? email;
  final String? role; // 'client' | 'driver' | null
  final String? avatarUrl;
  final bool isVerified;
  final String? referralCode;
  final double? ratingAvg;
  final int? ratingCount;

  factory UserModel.fromJson(Map<String, dynamic> json) => UserModel(
        id: json['id'] as String? ?? '',
        phone: json['phone'] as String? ?? '',
        name: json['name'] as String?,
        email: json['email'] as String?,
        role: json['role'] as String?,
        avatarUrl: json['avatar_url'] as String?,
        isVerified: json['is_verified'] as bool? ?? false,
        referralCode: json['referral_code'] as String?,
        ratingAvg: (json['rating_avg'] as num?)?.toDouble(),
        ratingCount: (json['rating_count'] as num?)?.toInt(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'phone': phone,
        'name': name,
        'email': email,
        'role': role,
        'avatar_url': avatarUrl,
        'is_verified': isVerified,
        'referral_code': referralCode,
        'rating_avg': ratingAvg,
        'rating_count': ratingCount,
      };

  UserModel copyWith({
    String? id,
    String? phone,
    String? name,
    String? email,
    String? role,
    String? avatarUrl,
    bool? isVerified,
    String? referralCode,
    double? ratingAvg,
    int? ratingCount,
  }) =>
      UserModel(
        id: id ?? this.id,
        phone: phone ?? this.phone,
        name: name ?? this.name,
        email: email ?? this.email,
        role: role ?? this.role,
        avatarUrl: avatarUrl ?? this.avatarUrl,
        isVerified: isVerified ?? this.isVerified,
        referralCode: referralCode ?? this.referralCode,
        ratingAvg: ratingAvg ?? this.ratingAvg,
        ratingCount: ratingCount ?? this.ratingCount,
      );
}
