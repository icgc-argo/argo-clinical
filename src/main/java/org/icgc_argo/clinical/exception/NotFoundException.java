package org.icgc_argo.clinical.exception;

import lombok.NonNull;

import static java.lang.String.format;

public class NotFoundException extends RuntimeException {

  public NotFoundException() {
  }

  public NotFoundException(String message) {
    super(message);
  }

  public NotFoundException(String message, Throwable cause) {
    super(message, cause);
  }

  public static void checkNotFound(boolean expression,String formattedString, Object ...args){
    if (!expression){
      throw createNotFoundException(formattedString, args);
    }
  }

  public static NotFoundException createNotFoundException(@NonNull String formattedString, Object ...args){
    return new NotFoundException(format(formattedString, args));
  }

}
