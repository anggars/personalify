import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class NativeGlass extends StatelessWidget {
  final String imageUrl;

  const NativeGlass({super.key, required this.imageUrl});

  @override
  Widget build(BuildContext context) {
    const String viewType = 'native-glass';
    final Map<String, dynamic> creationParams = <String, dynamic>{
      'imageUrl': imageUrl,
    };

    return AndroidView(
      viewType: viewType,
      layoutDirection: TextDirection.ltr,
      creationParams: creationParams,
      creationParamsCodec: const StandardMessageCodec(),
    );
  }
}
