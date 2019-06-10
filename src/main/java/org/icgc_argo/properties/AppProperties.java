package org.icgc_argo.properties;

import javax.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;
import lombok.experimental.FieldNameConstants;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

@Slf4j
@Component
@Validated
@Setter
@Getter
@FieldNameConstants
@ConfigurationProperties(prefix = AppProperties.APP_PROPERTIES_PREFIX)
public class AppProperties {
  public static final String APP_PROPERTIES_PREFIX = "app";

  /** Port used by grpc server */
  @NotNull private Integer grpcPort;

  /** GRPC can be disabled when doing test */
  @NotNull private Boolean grpcEnabled;
}
