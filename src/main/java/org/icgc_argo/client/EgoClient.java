package org.icgc_argo.client;

import static java.lang.String.format;
import static lombok.Lombok.checkNotNull;
import static org.springframework.http.HttpMethod.GET;

import org.icgc_argo.properties.EgoProperties;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import lombok.Data;
import lombok.NonNull;
import lombok.experimental.Accessors;
import lombok.extern.slf4j.Slf4j;
import lombok.val;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.retry.support.RetryTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Slf4j
@Component
public class EgoClient {

  private final EgoProperties egoProperties;
  private final RetryTemplate retryTemplate;
  private final RestTemplate restTemplate;

  @Autowired
  public EgoClient(
      @NonNull EgoProperties egoProperties,
      @NonNull RetryTemplate strictRetryTemplate,
      @NonNull RestTemplate egoRestTemplate) {
    this.egoProperties = egoProperties;
    this.retryTemplate = strictRetryTemplate;
    this.restTemplate = egoRestTemplate;
  }

  public String getPublicKey() {
    return retry(
            () ->
                restTemplate.getForEntity(
                    egoProperties.getUrl() + "/oauth/token/public_key", String.class))
        .getBody();
  }

  public List<EgoUser> listUsers(int offset, int limit, String query) {
    val egoPage =
        retry(
                () ->
                    restTemplate.exchange(
                        egoProperties.getUrl()
                            + format("/users?offset=%s&limit=%s&query=%s", offset, limit, query),
                        GET,
                        null,
                        new ParameterizedTypeReference<EgoPage<EgoUser>>() {}))
            .getBody();
    checkNotNull(egoPage, "body was null, was expecting not null");
    return egoPage.getResultSet();
  }

  private <T> T retry(Supplier<T> supplier) {
    return retryTemplate.execute(r -> supplier.get());
  }

  private void retryRunnable(Runnable runnable) {
    retryTemplate.execute(
        r -> {
          runnable.run();
          return r;
        });
  }

  @Data
  public static class EgoPage<T> {
    public List<T> resultSet;
    public Integer limit;
    public Integer offset;
  }

  @Data
  @Accessors(chain = true)
  public static class EgoUser {
    private UUID id;
    private String firstName;
    private String lastName;
    private String email;
    private EgoUserType type;
    private EgoStatusType status;
  }

  public enum EgoStatusType {
    APPROVED,
    DISABLED,
    REJECTED,
    PENDING;
  }

  public enum EgoUserType {
    USER,
    ADMIN;
  }
}
