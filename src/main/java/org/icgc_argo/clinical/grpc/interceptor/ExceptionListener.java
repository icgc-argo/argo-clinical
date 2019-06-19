package org.icgc_argo.clinical.grpc.interceptor;

import io.grpc.Metadata;
import io.grpc.ServerCall;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import lombok.AllArgsConstructor;

@AllArgsConstructor
public class ExceptionListener<ReqT, RespT> extends ServerCall.Listener<ReqT> {
  private final ServerCall<ReqT, RespT> call;
  private final ServerCall.Listener<ReqT> listener;

  @Override
  public void onMessage(ReqT message) {
    try {
      listener.onMessage(message);
    } catch (Throwable e) {
      closeWithException(e);
    }
  }

  @Override
  public void onHalfClose() {
    try {
      listener.onHalfClose();
    } catch (Throwable e) {
      closeWithException(e);
    }
  }

  @Override
  public void onCancel() {
    try {
      listener.onCancel();
    } catch (Throwable e) {
      closeWithException(e);
    }
  }

  @Override
  public void onComplete() {
    try {
      listener.onComplete();
    } catch (Throwable e) {
      closeWithException(e);
    }
  }

  @Override
  public void onReady() {
    try {
      listener.onReady();
    } catch (Throwable e) {
      closeWithException(e);
    }
  }

  private void closeWithException(Throwable t) {
    StatusRuntimeException exception;
    if (t instanceof StatusRuntimeException) {
      exception = (StatusRuntimeException) t;
    } else {
      exception = toStatus(t);
    }
    Metadata metadata = exception.getTrailers();
    if (metadata == null) {
      metadata = new Metadata();
    }
    call.close(exception.getStatus(), metadata);
  }

  private StatusRuntimeException toStatus(Throwable t) {
    return Status.INTERNAL.augmentDescription(t.getMessage()).asRuntimeException();
  }
}
