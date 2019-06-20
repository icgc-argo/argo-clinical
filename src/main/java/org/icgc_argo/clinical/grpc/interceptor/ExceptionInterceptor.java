package org.icgc_argo.clinical.grpc.interceptor;

import io.grpc.*;
import lombok.val;
import org.springframework.stereotype.Service;

@Service
public class ExceptionInterceptor implements ServerInterceptor {
  @Override
  public <ReqT, RespT> ServerCall.Listener<ReqT> interceptCall(
      ServerCall<ReqT, RespT> call,
      Metadata headers,
      ServerCallHandler<ReqT, RespT> next) {

    val listener = next.startCall(call, headers);
    return new ExceptionListener<>(call, listener);
  }
}
