/*
 * Copyright (c) 2019. Ontario Institute for Cancer Research
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 */

package org.icgc_argo.clinical.security;

import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTDecodeException;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.security.interfaces.RSAPublicKey;
import java.util.Optional;
import javax.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NonNull;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import lombok.val;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@Profile("auth")
public class EgoSecurity {

  private static final String EGO = "ego";

  private final RSAPublicKey egoPublicKey;

  @Autowired
  public EgoSecurity(@NonNull RSAPublicKey egoPublicKey) {
    this.egoPublicKey = egoPublicKey;
  }

  public Optional<EgoToken> verifyToken(String jwtToken) {
    try {
      Algorithm algorithm = Algorithm.RSA256(egoPublicKey, null);
      JWTVerifier verifier =
          JWT.require(algorithm).withIssuer(EGO).build(); // Reusable verifier instance
      val jwt = verifier.verify(jwtToken);
      return parseToken(jwt);
    } catch (JWTVerificationException | NullPointerException e) {
      // Handle NPE defensively for null JWT.
      return Optional.empty();
    }
  }

  private Optional<EgoToken> parseToken(DecodedJWT jwt) {
    try {
      EgoToken egoToken = new EgoToken(jwt, jwt.getClaim("context").as(Context.class));
      return Optional.of(egoToken);
    } catch (JWTDecodeException exception) {
      // Invalid token
      return Optional.empty();
    }
  }

  public static class EgoToken extends Context.User {
    final DecodedJWT jwt;

    EgoToken(@NotNull DecodedJWT jwt, @NotNull Context context) {
      this.jwt = jwt;
      BeanUtils.copyProperties(context.user, this);
    }
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  @Setter
  @Getter
  private static class Context {
    User user;

    @JsonIgnoreProperties(ignoreUnknown = true)
    @Setter
    @Getter
    private static class User {
      String name;
      String email;
      String status;
      String firstName;
      String lastName;
      String test;
      String createdAt;
      String lastLogin;
      String preferredLanguage;
      String type;
      String[] groups;
      String[] permissions;
    }
  }
}
